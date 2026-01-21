/**
 * AISales Chat - Suggestions Module
 * Handles suggestion rendering, actions, and pending changes management
 *
 * @package AISales_Sales_Manager
 */

(function($) {
	'use strict';

	const app = window.AISalesChat = window.AISalesChat || {};
	const utils = app.utils;

	/**
	 * Suggestions namespace
	 */
	const suggestions = app.suggestions = {};

	// Get utility functions
	const escapeHtml = utils ? utils.escapeHtml : function(str) {
		if (!str) return '';
		return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
	};

	/**
	 * Initialize suggestions functionality
	 */
	suggestions.init = function() {
		suggestions.bindEvents();
	};

	/**
	 * Bind suggestion event handlers
	 */
	suggestions.bindEvents = function() {
		const elements = app.elements;

		// Accept/Discard all - Products
		$('#aisales-accept-all').on('click', suggestions.handleAcceptAll);
		$('#aisales-discard-all').on('click', suggestions.handleDiscardAll);
		
		// Accept/Discard all - Categories
		$('#aisales-category-accept-all').on('click', suggestions.handleAcceptAll);
		$('#aisales-category-discard-all').on('click', suggestions.handleDiscardAll);

		// Suggestion actions (delegated)
		elements.messagesContainer.on('click', '.aisales-suggestion [data-action]', suggestions.handleSuggestionAction);

		// Catalog suggestion actions
		elements.messagesContainer.on('click', '.aisales-catalog-suggestion [data-action]', suggestions.handleCatalogSuggestionAction);

		// Product panel suggestion actions
		elements.productInfo.on('click', '.aisales-pending-change__actions [data-action]', suggestions.handlePendingChangeAction);
		
		// Category panel suggestion actions
		elements.categoryInfo.on('click', '.aisales-pending-change__actions [data-action]', suggestions.handlePendingChangeAction);
	};

	/**
	 * Handle received suggestion from API
	 * @param {Object} suggestion - Suggestion data
	 */
	suggestions.handleSuggestionReceived = function(suggestion) {
		const state = app.state;
		state.pendingSuggestions[suggestion.id] = suggestion;
		suggestions.renderSuggestionInMessage(suggestion);
		suggestions.showPendingChange(suggestion);
		suggestions.updatePendingSummary();
	};

	/**
	 * Handle suggestion action (apply/edit/discard)
	 * @param {Event} e - Click event
	 */
	suggestions.handleSuggestionAction = function(e) {
		e.preventDefault();
		const action = $(e.currentTarget).data('action');
		const $suggestion = $(e.currentTarget).closest('.aisales-suggestion');
		const suggestionId = $suggestion.data('suggestion-id');

		if (action === 'apply') {
			suggestions.apply(suggestionId, $suggestion);
		} else if (action === 'discard') {
			suggestions.discard(suggestionId, $suggestion);
		} else if (action === 'edit') {
			suggestions.edit(suggestionId, $suggestion);
		}
	};

	/**
	 * Handle pending change action in entity panel
	 * @param {Event} e - Click event
	 */
	suggestions.handlePendingChangeAction = function(e) {
		e.preventDefault();
		const state = app.state;
		const action = $(e.currentTarget).data('action');
		const $field = $(e.currentTarget).closest('.aisales-product-info__field, .aisales-category-info__field');
		const fieldType = $field.data('field');

		// Find matching suggestion
		const suggestion = Object.values(state.pendingSuggestions).find(function(s) {
			return s.suggestion_type === fieldType && s.status === 'pending';
		});

		if (suggestion) {
			if (action === 'accept') {
				suggestions.apply(suggestion.id);
			} else if (action === 'undo') {
				suggestions.discard(suggestion.id);
			}
		}
	};

	/**
	 * Apply a suggestion
	 * @param {string} suggestionId - Suggestion ID
	 * @param {jQuery} $element - Optional element to update
	 */
	suggestions.apply = function(suggestionId, $element) {
		const state = app.state;
		const suggestion = state.pendingSuggestions[suggestionId];
		if (!suggestion) return;

		$.ajax({
			url: aisalesChat.apiBaseUrl + '/ai/chat/sessions/' + state.sessionId + '/suggestions/' + suggestionId,
			method: 'PATCH',
			headers: {
				'Content-Type': 'application/json',
				'X-API-Key': aisalesChat.apiKey
			},
			data: JSON.stringify({ action: 'apply' }),
			success: function(response) {
				// Handle both { success: true, data: {...} } and { suggestion: {...} } formats
				const appliedSuggestion = response.suggestion || (response.data && response.data.suggestion);
				if (appliedSuggestion || response.success) {
					suggestion.status = 'applied';

					// Update entity data based on type
					if (state.entityType === 'category') {
						suggestions.updateCategoryField(suggestion.suggestion_type, suggestion.suggested_value);
						suggestions.saveCategoryField(suggestion.suggestion_type, suggestion.suggested_value);
					} else {
						suggestions.updateProductField(suggestion.suggestion_type, suggestion.suggested_value);
						suggestions.saveProductField(suggestion.suggestion_type, suggestion.suggested_value);
					}

					// Update UI
					if ($element) {
						$element.addClass('aisales-suggestion--applied');
						$element.find('.aisales-suggestion__actions').html(
							'<span class="aisales-suggestion__status aisales-suggestion__status--applied">' +
							'<span class="dashicons dashicons-yes-alt"></span> ' +
							aisalesChat.i18n.applied +
							'</span>'
						);
					}

					// Update entity panel
					suggestions.hidePendingChange(suggestion.suggestion_type);
					delete state.pendingSuggestions[suggestionId];
					suggestions.updatePendingSummary();
				}
			},
			error: function(xhr) {
				if (app.messaging && app.messaging.handleError) {
					app.messaging.handleError(xhr);
				}
			}
		});
	};

	/**
	 * Discard a suggestion
	 * @param {string} suggestionId - Suggestion ID
	 * @param {jQuery} $element - Optional element to update
	 */
	suggestions.discard = function(suggestionId, $element) {
		const state = app.state;
		const suggestion = state.pendingSuggestions[suggestionId];
		if (!suggestion) return;

		$.ajax({
			url: aisalesChat.apiBaseUrl + '/ai/chat/sessions/' + state.sessionId + '/suggestions/' + suggestionId,
			method: 'PATCH',
			headers: {
				'Content-Type': 'application/json',
				'X-API-Key': aisalesChat.apiKey
			},
			data: JSON.stringify({ action: 'discard' }),
			success: function(response) {
				// Handle both { success: true, data: {...} } and { suggestion: {...} } formats
				const discardedSuggestion = response.suggestion || (response.data && response.data.suggestion);
				if (discardedSuggestion || response.success) {
					suggestion.status = 'discarded';

					// Update UI
					if ($element) {
						$element.addClass('aisales-suggestion--discarded');
						$element.find('.aisales-suggestion__actions').html(
							'<span class="aisales-suggestion__status aisales-suggestion__status--discarded">' +
							'<span class="dashicons dashicons-dismiss"></span> ' +
							aisalesChat.i18n.discarded +
							'</span>'
						);
					}

					// Update product panel
					suggestions.hidePendingChange(suggestion.suggestion_type);
					delete state.pendingSuggestions[suggestionId];
					suggestions.updatePendingSummary();
				}
			},
			error: function(xhr) {
				if (app.messaging && app.messaging.handleError) {
					app.messaging.handleError(xhr);
				}
			}
		});
	};

	/**
	 * Edit a suggestion (show in text input)
	 * @param {string} suggestionId - Suggestion ID
	 * @param {jQuery} $element - Element reference
	 */
	suggestions.edit = function(suggestionId, $element) {
		const state = app.state;
		const suggestion = state.pendingSuggestions[suggestionId];
		if (!suggestion) return;

		// Pre-fill the input with suggested value
		app.elements.messageInput.val('Please modify: ' + suggestion.suggested_value);
		app.elements.messageInput.focus();
	};

	/**
	 * Handle accept all pending suggestions
	 */
	suggestions.handleAcceptAll = function() {
		const state = app.state;
		const pending = Object.keys(state.pendingSuggestions);
		if (pending.length === 0) return;

		pending.forEach(function(suggestionId) {
			const $element = $('[data-suggestion-id="' + suggestionId + '"]');
			suggestions.apply(suggestionId, $element);
		});
	};

	/**
	 * Handle discard all pending suggestions
	 */
	suggestions.handleDiscardAll = function() {
		const state = app.state;
		const pending = Object.keys(state.pendingSuggestions);
		if (pending.length === 0) return;

		pending.forEach(function(suggestionId) {
			const $element = $('[data-suggestion-id="' + suggestionId + '"]');
			suggestions.discard(suggestionId, $element);
		});
	};

	/**
	 * Render suggestion in message - groups multiple suggestions of same type
	 * @param {Object} suggestion - Suggestion data
	 */
	suggestions.renderSuggestionInMessage = function(suggestion) {
		const elements = app.elements;
		const typeLabels = {
			// Product fields
			'title': aisalesChat.i18n.improveTitle || 'Improve Title',
			'description': aisalesChat.i18n.improveDescription || 'Improve Description',
			'short_description': 'Short Description',
			'tags': aisalesChat.i18n.suggestTags || 'Tags',
			'categories': aisalesChat.i18n.suggestCategories || 'Categories',
			'meta_description': 'Meta Description',
			// Category fields
			'name': 'Category Name',
			'seo_title': 'SEO Title',
			'seo_description': 'SEO Description',
			'subcategories': 'Subcategories'
		};

		const $container = elements.messagesContainer.find('[data-streaming="true"]').length
			? elements.messagesContainer.find('[data-streaming="true"] .aisales-message__content')
			: elements.messagesContainer.find('.aisales-message--assistant').last().find('.aisales-message__content');

		if (!$container.length) return;

		// Check if there's already a group for this suggestion type
		let $group = $container.find('.aisales-suggestions-group[data-type="' + suggestion.suggestion_type + '"]');

		if ($group.length) {
			// Add to existing group
			const $options = $group.find('.aisales-suggestions-group__options');
			const optionNumber = $options.find('.aisales-suggestion').length + 1;
			
			const optionHtml = suggestions.renderSuggestionOption(suggestion, optionNumber);
			$options.append(optionHtml);
			
			// Update count
			$group.find('.aisales-suggestions-group__count').text(optionNumber + ' options');
		} else {
			// Create new group
			const groupHtml = '<div class="aisales-suggestions-group" data-type="' + suggestion.suggestion_type + '">' +
				'<div class="aisales-suggestions-group__header">' +
					'<div class="aisales-suggestions-group__title">' +
						'<span class="dashicons dashicons-lightbulb"></span>' +
						'<span>' + (typeLabels[suggestion.suggestion_type] || suggestion.suggestion_type) + '</span>' +
					'</div>' +
					'<span class="aisales-suggestions-group__count">1 option</span>' +
				'</div>' +
				'<div class="aisales-suggestions-group__current">' +
					'<div class="aisales-suggestions-group__current-label">Current value</div>' +
					'<div class="aisales-suggestions-group__current-value">' + escapeHtml(suggestion.current_value || 'None') + '</div>' +
				'</div>' +
				'<div class="aisales-suggestions-group__options">' +
					suggestions.renderSuggestionOption(suggestion, 1) +
				'</div>' +
			'</div>';

			$container.append(groupHtml);
		}
	};

	/**
	 * Render a single suggestion option within a group
	 * @param {Object} suggestion - Suggestion data
	 * @param {number} number - Option number
	 * @returns {string} HTML string
	 */
	suggestions.renderSuggestionOption = function(suggestion, number) {
		return '<div class="aisales-suggestion" data-suggestion-id="' + suggestion.id + '" data-suggestion-type="' + suggestion.suggestion_type + '">' +
			'<span class="aisales-suggestion__number">' + number + '</span>' +
			'<div class="aisales-suggestion__content">' +
				'<div class="aisales-suggestion__value">' + escapeHtml(suggestion.suggested_value) + '</div>' +
			'</div>' +
			'<div class="aisales-suggestion__actions">' +
				'<button type="button" class="aisales-btn aisales-btn--success aisales-btn--sm" data-action="apply">' +
					'<span class="dashicons dashicons-yes"></span> Apply' +
				'</button>' +
				'<button type="button" class="aisales-btn aisales-btn--outline aisales-btn--sm" data-action="discard">' +
					'<span class="dashicons dashicons-no"></span>' +
				'</button>' +
			'</div>' +
		'</div>';
	};

	/**
	 * Show pending change in entity panel
	 * @param {Object} suggestion - Suggestion data
	 */
	suggestions.showPendingChange = function(suggestion) {
		const state = app.state;
		const elements = app.elements;

		// Determine which panel to update
		const $panel = state.entityType === 'category' ? elements.categoryInfo : elements.productInfo;
		const $field = $panel.find('[data-field="' + suggestion.suggestion_type + '"]');
		if (!$field.length) return;

		$field.addClass('aisales-product-info__field--has-pending aisales-category-info__field--has-pending');
		const $pending = $field.find('.aisales-product-info__pending, .aisales-category-info__pending');

		if (suggestion.suggestion_type === 'tags' || suggestion.suggestion_type === 'categories' || suggestion.suggestion_type === 'subcategories') {
			// Handle array fields
			const currentArr = (suggestion.current_value || '').split(',').map(s => s.trim()).filter(Boolean);
			const suggestedArr = (suggestion.suggested_value || '').split(',').map(s => s.trim()).filter(Boolean);
			const added = suggestedArr.filter(t => !currentArr.includes(t));
			const removed = currentArr.filter(t => !suggestedArr.includes(t));

			$pending.find('.aisales-pending-change__added').html(
				added.map(t => '<span class="aisales-tag aisales-tag--added">+ ' + escapeHtml(t) + '</span>').join('')
			);
			$pending.find('.aisales-pending-change__removed').html(
				removed.map(t => '<span class="aisales-tag aisales-tag--removed">- ' + escapeHtml(t) + '</span>').join('')
			);
		} else {
			// Handle text fields - only show new value
			$pending.find('.aisales-pending-change__new').text(suggestion.suggested_value);
		}

		$pending.slideDown(200);
	};

	/**
	 * Hide pending change in entity panel
	 * @param {string} fieldType - Field type to hide
	 */
	suggestions.hidePendingChange = function(fieldType) {
		const state = app.state;
		const elements = app.elements;

		const $panel = state.entityType === 'category' ? elements.categoryInfo : elements.productInfo;
		const $field = $panel.find('[data-field="' + fieldType + '"]');
		$field.removeClass('aisales-product-info__field--has-pending aisales-category-info__field--has-pending');
		$field.find('.aisales-product-info__pending, .aisales-category-info__pending').slideUp(200);
	};

	/**
	 * Clear all pending changes from entity panel
	 */
	suggestions.clearPendingChanges = function() {
		const elements = app.elements;
		elements.productInfo.find('.aisales-product-info__field--has-pending').removeClass('aisales-product-info__field--has-pending');
		elements.productInfo.find('.aisales-product-info__pending').hide();
		elements.categoryInfo.find('.aisales-category-info__field--has-pending').removeClass('aisales-category-info__field--has-pending');
		elements.categoryInfo.find('.aisales-category-info__pending').hide();
	};

	/**
	 * Update pending summary counter
	 */
	suggestions.updatePendingSummary = function() {
		const state = app.state;
		const elements = app.elements;

		const count = Object.keys(state.pendingSuggestions).filter(function(id) {
			return state.pendingSuggestions[id].status === 'pending';
		}).length;

		if (state.entityType === 'category') {
			$('#aisales-category-pending-count').text(count);
			if (count > 0) {
				elements.categoryPendingSummary.slideDown(200);
			} else {
				elements.categoryPendingSummary.slideUp(200);
			}
			elements.pendingSummary.hide();
		} else {
			$('#aisales-pending-count').text(count);
			if (count > 0) {
				elements.pendingSummary.slideDown(200);
			} else {
				elements.pendingSummary.slideUp(200);
			}
			elements.categoryPendingSummary.hide();
		}
	};

	/**
	 * Update product field in local state
	 * @param {string} fieldType - Field type
	 * @param {string} value - New value
	 */
	suggestions.updateProductField = function(fieldType, value) {
		const state = app.state;
		if (!state.selectedProduct) return;

		const fieldMap = {
			'title': 'title',
			'description': 'description',
			'short_description': 'short_description',
			'tags': 'tags',
			'categories': 'categories'
		};

		const field = fieldMap[fieldType];
		if (!field) return;

		if (field === 'tags' || field === 'categories') {
			state.selectedProduct[field] = value.split(',').map(s => s.trim()).filter(Boolean);
		} else {
			state.selectedProduct[field] = value;
		}

		// Update display
		if (app.entities && app.entities.updateProductPanel) {
			app.entities.updateProductPanel(state.selectedProduct);
		} else if (typeof app.updateProductPanel === 'function') {
			app.updateProductPanel(state.selectedProduct);
		}
	};

	/**
	 * Update category field in local state
	 * @param {string} fieldType - Field type
	 * @param {string} value - New value
	 */
	suggestions.updateCategoryField = function(fieldType, value) {
		const state = app.state;
		if (!state.selectedCategory) return;

		const fieldMap = {
			'name': 'name',
			'description': 'description',
			'seo_title': 'seo_title',
			'meta_description': 'meta_description',
			'subcategories': 'subcategories'
		};

		const field = fieldMap[fieldType];
		if (!field) return;

		if (field === 'subcategories') {
			state.selectedCategory[field] = value.split(',').map(s => ({ name: s.trim() })).filter(s => s.name);
		} else {
			state.selectedCategory[field] = value;
		}

		// Update display
		if (app.entities && app.entities.updateCategoryPanel) {
			app.entities.updateCategoryPanel(state.selectedCategory);
		} else if (typeof app.updateCategoryPanel === 'function') {
			app.updateCategoryPanel(state.selectedCategory);
		}
	};

	/**
	 * Save product field via WordPress AJAX
	 * @param {string} fieldType - Field type
	 * @param {string} value - New value
	 */
	suggestions.saveProductField = function(fieldType, value) {
		const state = app.state;
		if (!state.selectedProduct) return;

		$.ajax({
			url: aisalesChat.ajaxUrl,
			method: 'POST',
			data: {
				action: 'aisales_update_product_field',
				nonce: aisalesChat.nonce,
				product_id: state.selectedProduct.id,
				field: fieldType,
				value: value
			},
			success: function(response) {
				if (!response.success) {
					console.error('Failed to save product field:', response.data);
				}
			},
			error: function(xhr) {
				console.error('AJAX error:', xhr);
			}
		});
	};

	/**
	 * Save category field via WordPress AJAX
	 * @param {string} fieldType - Field type
	 * @param {string} value - New value
	 */
	suggestions.saveCategoryField = function(fieldType, value) {
		const state = app.state;
		if (!state.selectedCategory) return;

		$.ajax({
			url: aisalesChat.ajaxUrl,
			method: 'POST',
			data: {
				action: 'aisales_update_category_field',
				nonce: aisalesChat.nonce,
				category_id: state.selectedCategory.id,
				field: fieldType,
				value: value
			},
			success: function(response) {
				if (!response.success) {
					console.error('Failed to save category field:', response.data);
				}
			},
			error: function(xhr) {
				console.error('AJAX error:', xhr);
			}
		});
	};

	/**
	 * Render a catalog reorganization suggestion card
	 * @param {Object} suggestion - Catalog suggestion data
	 */
	suggestions.renderCatalogSuggestion = function(suggestion) {
		const elements = app.elements;

		var impactClass = 'aisales-catalog-suggestion__impact--' + (suggestion.impact || 'medium');
		var impactLabel = {
			'high': 'High Impact',
			'medium': 'Medium Impact',
			'low': 'Low Impact'
		}[suggestion.impact] || 'Medium Impact';

		var typeIcon = {
			'move_category': 'dashicons-move',
			'merge_categories': 'dashicons-randomize',
			'create_category': 'dashicons-plus-alt',
			'rename_category': 'dashicons-edit',
			'reassign_products': 'dashicons-products',
			'delete_empty_category': 'dashicons-trash'
		}[suggestion.type] || 'dashicons-category';

		var typeLabel = {
			'move_category': 'Move Category',
			'merge_categories': 'Merge Categories',
			'create_category': 'Create Category',
			'rename_category': 'Rename Category',
			'reassign_products': 'Reassign Products',
			'delete_empty_category': 'Delete Empty Category'
		}[suggestion.type] || 'Reorganize';

		var $suggestion = $(
			'<div class="aisales-catalog-suggestion" data-suggestion-id="' + escapeHtml(suggestion.id) + '">' +
				'<div class="aisales-catalog-suggestion__header">' +
					'<span class="aisales-catalog-suggestion__type">' +
						'<span class="dashicons ' + typeIcon + '"></span>' +
						escapeHtml(typeLabel) +
					'</span>' +
					'<span class="aisales-catalog-suggestion__impact ' + impactClass + '">' +
						escapeHtml(impactLabel) +
					'</span>' +
				'</div>' +
				'<div class="aisales-catalog-suggestion__title">' + escapeHtml(suggestion.title || '') + '</div>' +
				'<div class="aisales-catalog-suggestion__description">' + escapeHtml(suggestion.description || '') + '</div>' +
				'<div class="aisales-catalog-suggestion__comparison">' +
					'<div class="aisales-catalog-suggestion__before">' +
						'<span class="aisales-catalog-suggestion__label">Before:</span>' +
						'<span class="aisales-catalog-suggestion__value">' + escapeHtml(suggestion.before_state || '') + '</span>' +
					'</div>' +
					'<div class="aisales-catalog-suggestion__arrow"><span class="dashicons dashicons-arrow-right-alt"></span></div>' +
					'<div class="aisales-catalog-suggestion__after">' +
						'<span class="aisales-catalog-suggestion__label">After:</span>' +
						'<span class="aisales-catalog-suggestion__value">' + escapeHtml(suggestion.after_state || '') + '</span>' +
					'</div>' +
				'</div>' +
				'<div class="aisales-catalog-suggestion__actions">' +
					'<button type="button" class="aisales-btn aisales-btn--primary aisales-btn--sm" data-action="apply-catalog-change">' +
						'<span class="dashicons dashicons-yes"></span> Apply' +
					'</button>' +
					'<button type="button" class="aisales-btn aisales-btn--outline aisales-btn--sm" data-action="discard-catalog-change">' +
						'<span class="dashicons dashicons-no"></span> Discard' +
					'</button>' +
				'</div>' +
			'</div>'
		);

		// Store suggestion data on the element
		$suggestion.data('suggestion', suggestion);

		// Append to current streaming message or last assistant message
		var $target = elements.messagesContainer.find('[data-streaming="true"] .aisales-message__text');
		if (!$target.length) {
			$target = elements.messagesContainer.find('.aisales-message--assistant').last().find('.aisales-message__text');
		}

		if ($target.length) {
			$target.append($suggestion);
		}
		if (app.messaging && app.messaging.scrollToBottom) {
			app.messaging.scrollToBottom();
		}
	};

	/**
	 * Handle catalog suggestion actions (apply/discard)
	 * @param {Event} e - Click event
	 */
	suggestions.handleCatalogSuggestionAction = function(e) {
		var $btn = $(e.currentTarget);
		var action = $btn.data('action');
		var $suggestion = $btn.closest('.aisales-catalog-suggestion');
		var suggestionId = $suggestion.data('suggestion-id');
		var suggestionData = $suggestion.data('suggestion');

		if (action === 'apply-catalog-change') {
			suggestions.applyCatalogChange($suggestion, suggestionData);
		} else if (action === 'discard-catalog-change') {
			suggestions.discardCatalogChange($suggestion, suggestionId);
		}
	};

	/**
	 * Apply a catalog change suggestion
	 * @param {jQuery} $suggestion - Suggestion element
	 * @param {Object} suggestionData - Suggestion data
	 */
	suggestions.applyCatalogChange = function($suggestion, suggestionData) {
		if (!suggestionData || !suggestionData.actions || !suggestionData.actions.length) {
			if (app.context && app.context.showNotice) {
				app.context.showNotice('No actions to apply', 'error');
			}
			return;
		}

		// Show loading state
		$suggestion.addClass('aisales-catalog-suggestion--applying');
		$suggestion.find('[data-action="apply-catalog-change"]')
			.prop('disabled', true)
			.html('<span class="aisales-spinner"></span> Applying...');

		// Execute each action in sequence
		var actionsQueue = suggestionData.actions.slice();
		var completedActions = 0;
		var failedActions = 0;

		function executeNextAction() {
			if (actionsQueue.length === 0) {
				// All actions completed
				finishApply();
				return;
			}

			var action = actionsQueue.shift();
			
			$.ajax({
				url: aisalesChat.ajaxUrl,
				method: 'POST',
				data: {
					action: 'aisales_apply_catalog_change',
					nonce: aisalesChat.nonce,
					action_type: action.action_type,
					params: JSON.stringify(action.params || {})
				},
				success: function(response) {
					if (response.success) {
						completedActions++;
					} else {
						failedActions++;
						console.error('Catalog action failed:', response.data);
					}
					executeNextAction();
				},
				error: function(xhr, status, error) {
					failedActions++;
					console.error('Catalog action error:', error);
					executeNextAction();
				}
			});
		}

		function finishApply() {
			$suggestion.removeClass('aisales-catalog-suggestion--applying');
			
			var showNotice = app.context && app.context.showNotice ? app.context.showNotice : function() {};
			
			if (failedActions === 0) {
				$suggestion.addClass('aisales-catalog-suggestion--applied');
				$suggestion.find('.aisales-catalog-suggestion__actions').html(
					'<span class="aisales-catalog-suggestion__status aisales-catalog-suggestion__status--success">' +
						'<span class="dashicons dashicons-yes-alt"></span> Applied successfully' +
					'</span>'
				);
				showNotice('Catalog change applied successfully', 'success');
			} else if (completedActions > 0) {
				$suggestion.addClass('aisales-catalog-suggestion--partial');
				$suggestion.find('.aisales-catalog-suggestion__actions').html(
					'<span class="aisales-catalog-suggestion__status aisales-catalog-suggestion__status--warning">' +
						'<span class="dashicons dashicons-warning"></span> Partially applied (' + completedActions + '/' + (completedActions + failedActions) + ')' +
					'</span>'
				);
				showNotice('Some changes could not be applied', 'warning');
			} else {
				$suggestion.find('[data-action="apply-catalog-change"]')
					.prop('disabled', false)
					.html('<span class="dashicons dashicons-yes"></span> Apply');
				showNotice('Failed to apply changes', 'error');
			}
		}

		executeNextAction();
	};

	/**
	 * Discard a catalog change suggestion
	 * @param {jQuery} $suggestion - Suggestion element
	 * @param {string} suggestionId - Suggestion ID
	 */
	suggestions.discardCatalogChange = function($suggestion, suggestionId) {
		$suggestion.addClass('aisales-catalog-suggestion--discarded');
		$suggestion.find('.aisales-catalog-suggestion__actions').html(
			'<span class="aisales-catalog-suggestion__status aisales-catalog-suggestion__status--discarded">' +
				'<span class="dashicons dashicons-dismiss"></span> Discarded' +
			'</span>'
		);
	};

	/**
	 * Show research confirmation modal
	 * @param {Object} data - Research data
	 */
	suggestions.showResearchConfirmation = function(data) {
		// Remove any existing modal
		$('#aisales-research-confirm-modal').remove();

		var researchTypeLabels = {
			'competitor_analysis': 'Competitor Analysis',
			'market_trends': 'Market Trends',
			'product_gaps': 'Product Gap Analysis',
			'pricing_strategy': 'Pricing Strategy'
		};

		var depthLabels = {
			'quick': 'Quick',
			'standard': 'Standard',
			'thorough': 'Thorough'
		};

		var typeLabel = researchTypeLabels[data.research_type] || data.research_type || 'Market Research';
		var depthLabel = depthLabels[data.depth] || data.depth || 'Standard';

		var modalHtml =
			'<div id="aisales-research-confirm-modal" class="aisales-modal">' +
				'<div class="aisales-modal__backdrop"></div>' +
				'<div class="aisales-modal__content aisales-modal__content--sm">' +
					'<div class="aisales-modal__header">' +
						'<h3 class="aisales-modal__title">' +
							'<span class="dashicons dashicons-chart-area"></span> Confirm Market Research' +
						'</h3>' +
						'<button type="button" class="aisales-modal__close"><span class="dashicons dashicons-no-alt"></span></button>' +
					'</div>' +
					'<div class="aisales-modal__body">' +
						'<p class="aisales-research-confirm__intro">This research will use AI tokens. Please confirm to proceed.</p>' +
						'<div class="aisales-research-confirm__details">' +
							'<div class="aisales-research-confirm__row">' +
								'<span class="aisales-research-confirm__label">Research Type:</span>' +
								'<span class="aisales-research-confirm__value">' + escapeHtml(typeLabel) + '</span>' +
							'</div>' +
							'<div class="aisales-research-confirm__row">' +
								'<span class="aisales-research-confirm__label">Context:</span>' +
								'<span class="aisales-research-confirm__value">' + escapeHtml(data.context || 'Your store') + '</span>' +
							'</div>' +
							'<div class="aisales-research-confirm__row">' +
								'<span class="aisales-research-confirm__label">Depth:</span>' +
								'<span class="aisales-research-confirm__value">' + escapeHtml(depthLabel) + '</span>' +
							'</div>' +
							'<div class="aisales-research-confirm__row aisales-research-confirm__row--highlight">' +
								'<span class="aisales-research-confirm__label">Estimated Cost:</span>' +
								'<span class="aisales-research-confirm__value aisales-research-confirm__cost">' +
									'<span class="dashicons dashicons-database"></span> ' +
									escapeHtml(data.estimated_cost_display || '~5K tokens') +
								'</span>' +
							'</div>' +
						'</div>' +
						(data.use_web_search ?
							'<p class="aisales-research-confirm__note">' +
								'<span class="dashicons dashicons-admin-site-alt3"></span> ' +
								'Web search enabled - results will include current market data' +
							'</p>' : ''
						) +
					'</div>' +
					'<div class="aisales-modal__footer">' +
						'<button type="button" class="aisales-btn aisales-btn--outline" data-action="cancel">' +
							'Cancel' +
						'</button>' +
						'<button type="button" class="aisales-btn aisales-btn--primary" data-action="confirm">' +
							'<span class="dashicons dashicons-yes"></span> Confirm & Run Research' +
						'</button>' +
					'</div>' +
				'</div>' +
			'</div>';

		$('body').append(modalHtml);

		var $modal = $('#aisales-research-confirm-modal');

		// Store data on modal for later use
		$modal.data('research-data', data);

		// Show modal with animation
		setTimeout(function() {
			$modal.addClass('aisales-modal--open');
		}, 10);

		// Handle close
		$modal.on('click', '.aisales-modal__close, .aisales-modal__backdrop, [data-action="cancel"]', function() {
			suggestions.closeResearchConfirmModal();
			// Send a message that user cancelled
			if (app.sendMessage) {
				app.sendMessage('I\'ll skip the market research for now.');
			}
		});

		// Handle confirm
		$modal.on('click', '[data-action="confirm"]', function() {
			var researchData = $modal.data('research-data');
			suggestions.closeResearchConfirmModal();
			// Send confirmation message to continue research
			if (app.sendMessage) {
				app.sendMessage('Yes, please proceed with the ' + (researchTypeLabels[researchData.research_type] || 'market research') + '.');
			}
		});

		// Handle escape key
		$(document).on('keydown.researchConfirmModal', function(e) {
			if (e.key === 'Escape') {
				suggestions.closeResearchConfirmModal();
			}
		});
	};

	/**
	 * Close research confirmation modal
	 */
	suggestions.closeResearchConfirmModal = function() {
		var $modal = $('#aisales-research-confirm-modal');
		$modal.removeClass('aisales-modal--open');
		$(document).off('keydown.researchConfirmModal');
		setTimeout(function() {
			$modal.remove();
		}, 300);
	};

	// Expose for backward compatibility
	window.AISalesChat.handleSuggestionReceived = suggestions.handleSuggestionReceived;
	window.AISalesChat.updatePendingSummary = suggestions.updatePendingSummary;
	window.AISalesChat.renderSuggestionInMessage = suggestions.renderSuggestionInMessage;
	window.AISalesChat.showPendingChange = suggestions.showPendingChange;
	window.AISalesChat.clearPendingChanges = suggestions.clearPendingChanges;
	window.AISalesChat.renderCatalogSuggestion = suggestions.renderCatalogSuggestion;
	window.AISalesChat.showResearchConfirmation = suggestions.showResearchConfirmation;

})(jQuery);
