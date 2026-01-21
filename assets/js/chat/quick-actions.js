/**
 * AI Sales Chat - Quick Actions Module
 * Handles quick action button clicks for products, categories, and agent
 */
(function($) {
	'use strict';

	// Get app reference
	var app = window.AISalesChat = window.AISalesChat || {};

	/**
	 * Quick Actions module
	 */
	var quickActions = {
		/**
		 * Handle product quick action button click
		 * @param {Event} e - Click event
		 */
		handleProductQuickAction: function(e) {
			var action = $(e.currentTarget).data('action');
			if (!action || !app.state.selectedProduct) return;

			// Show modal for image generation actions
			if (action === 'generate_product_image' || action === 'enhance_product_image') {
				app.showImageGenerationModal('product');
				return;
			}

			var actionMessages = {
				'improve_title': 'Please improve the product title',
				'improve_description': 'Please improve the product description',
				'seo_optimize': 'Please optimize this product for SEO',
				'suggest_tags': 'Please suggest relevant tags for this product',
				'suggest_categories': 'Please suggest appropriate categories for this product',
				'generate_content': 'Please generate comprehensive content for this product'
			};

			var message = actionMessages[action] || 'Help with this product';
			app.sendMessage(message, action);
		},

		/**
		 * Handle category quick action button click
		 * @param {Event} e - Click event
		 */
		handleCategoryQuickAction: function(e) {
			var action = $(e.currentTarget).data('action');
			if (!action || !app.state.selectedCategory) return;

			// Show modal for image generation action
			if (action === 'generate_category_image') {
				app.showImageGenerationModal('category');
				return;
			}

			var actionMessages = {
				'improve_name': 'Please suggest a better name for this category',
				'improve_cat_description': 'Please generate a compelling description for this category',
				'cat_seo_optimize': 'Please optimize this category for SEO including title and meta description',
				'generate_cat_content': 'Please fully optimize this category - improve the name, generate a description, and add SEO content'
			};

			var message = actionMessages[action] || 'Help with this category';
			app.sendMessage(message, action);
		},

		/**
		 * Handle agent quick action button click
		 * @param {Event} e - Click event
		 */
		handleAgentQuickAction: function(e) {
			var action = $(e.currentTarget).data('action');
			if (!action || !app.state.isAgentMode) return;

			// Show modal for image generation action
			if (action === 'generate_image') {
				app.showImageGenerationModal('agent');
				return;
			}

			var actionMessages = {
				'create_campaign': 'Help me create a marketing campaign for my store',
				'social_content': 'Generate social media content for my store products',
				'email_campaign': 'Create an email marketing campaign',
				'store_analysis': 'Analyze my store and suggest improvements',
				'bulk_optimize': 'Suggest bulk optimization strategies for my products',
				'catalog_organize': 'Analyze my catalog structure and suggest improvements',
				'catalog_research': 'Help me with market research for my store'
			};

			var message = actionMessages[action] || 'Help with marketing';
			app.sendMessage(message, action);
		},

		/**
		 * Handle new chat button
		 */
		handleNewChat: function() {
			// Clear pending state
			app.state.pendingSuggestions = {};
			app.updatePendingSummary();
			app.suggestions.clearPendingChanges();

			// Clear current session
			app.state.sessionId = null;
			app.state.messages = [];
			app.state.selectedProduct = null;
			app.state.selectedCategory = null;
			app.state.isAgentMode = false;

			// Clear chat messages UI
			app.elements.messagesContainer.find('.aisales-message').remove();
			app.elements.chatWelcome.show();

			// Hide entity panels
			app.elements.productInfo.hide();
			app.elements.categoryInfo.hide();
			app.elements.agentInfo.hide();
			app.elements.entityEmpty.show();

			// Disable quick actions
			$('.aisales-quick-actions button[data-action]').prop('disabled', true);

			// Reset and show wizard for new selection
			if (app.wizard) {
				app.wizard.resetWizard();
				app.wizard.showWizard();
			}
		},

		/**
		 * Handle expand toggle for description
		 * @param {Event} e - Click event
		 */
		handleExpandToggle: function(e) {
			var $field = $(e.currentTarget).closest('.aisales-product-info__field, .aisales-category-info__field');
			$field.toggleClass('aisales-product-info__field--expanded aisales-category-info__field--expanded');
			$field.find('.aisales-product-info__value, .aisales-category-info__value').toggleClass('aisales-product-info__value--truncated aisales-category-info__value--truncated');
		},

		/**
		 * Handle welcome card click
		 * @param {Event} e - Click event
		 */
		handleWelcomeCardClick: function(e) {
			var $card = $(e.currentTarget);
			var entityType = $card.data('entity');

			if (entityType && entityType !== app.state.entityType) {
				app.state.entityType = entityType;
				app.state.isAgentMode = (entityType === 'agent');

				if (app.updateEntityTabs) app.updateEntityTabs();
				if (app.populateEntitySelector) app.populateEntitySelector();
				if (app.updateQuickActionsVisibility) app.updateQuickActionsVisibility();
				if (app.updateEmptyState) app.updateEmptyState();

				// If agent mode, activate immediately
				if (entityType === 'agent') {
					if (app.panels) {
						app.panels.selectAgent();
					}
					return;
				}
			}

			// Focus the selector (for product/category modes)
			app.elements.entitySelect.focus();
		},

		/**
		 * Handle inline option click
		 * @param {Event} e - Click event
		 */
		handleInlineOptionClick: function(e) {
			e.preventDefault();
			var $btn = $(e.currentTarget);
			var value = $btn.data('option-value');

			if (value && app.state.sessionId) {
				// Disable the button to prevent double-clicks
				$btn.prop('disabled', true);
				// Send the option value as a message
				app.sendMessage(value);
			}
		},

		/**
		 * Bind quick action events
		 */
		bindEvents: function() {
			var self = this;

			// Product quick actions
			$(document).on('click', '.aisales-product-quick-actions button[data-action]', function(e) {
				self.handleProductQuickAction(e);
			});

			// Category quick actions
			$(document).on('click', '.aisales-category-quick-actions button[data-action]', function(e) {
				self.handleCategoryQuickAction(e);
			});

			// Agent quick actions
			$(document).on('click', '.aisales-agent-quick-actions button[data-action]', function(e) {
				self.handleAgentQuickAction(e);
			});

			// New chat button
			$(document).on('click', '#aisales-new-chat', function() {
				self.handleNewChat();
			});

			// Expand toggle
			$(document).on('click', '.aisales-product-info__expand, .aisales-category-info__expand', function(e) {
				self.handleExpandToggle(e);
			});

			// Welcome cards
			$(document).on('click', '.aisales-welcome-card', function(e) {
				self.handleWelcomeCardClick(e);
			});

			// Inline options
			$(document).on('click', '.aisales-inline-option', function(e) {
				self.handleInlineOptionClick(e);
			});
		}
	};

	// Expose module
	app.quickActions = quickActions;

	// Expose individual functions for backward compatibility
	window.AISalesChat.handleProductQuickAction = quickActions.handleProductQuickAction.bind(quickActions);
	window.AISalesChat.handleCategoryQuickAction = quickActions.handleCategoryQuickAction.bind(quickActions);
	window.AISalesChat.handleAgentQuickAction = quickActions.handleAgentQuickAction.bind(quickActions);
	window.AISalesChat.handleNewChat = quickActions.handleNewChat.bind(quickActions);

})(jQuery);
