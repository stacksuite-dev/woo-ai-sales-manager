/**
 * AISales Chat - Wizard Module
 * Step-by-step guided flow for task and entity selection
 *
 * @package AISales_Sales_Manager
 */

(function($) {
	'use strict';

	const app = window.AISalesChat = window.AISalesChat || {};
	const utils = app.utils;

	/**
	 * Wizard namespace
	 */
	const wizard = app.wizard = {};

	/**
	 * Initialize the wizard
	 * Checks for preselected entities and shows/hides wizard accordingly
	 */
	wizard.init = function() {
		const state = app.state;
		const elements = app.elements;

		// Check if there's a preselected product or category (skip wizard)
		if (typeof window.aisalesPreselectedProduct !== 'undefined' && window.aisalesPreselectedProduct) {
			state.wizardComplete = true;
			state.wizardTask = 'product';
			wizard.hide();
			wizard.updateBreadcrumb('product', window.aisalesPreselectedProduct.title);
			return;
		}

		if (typeof window.aisalesPreselectedCategory !== 'undefined' && window.aisalesPreselectedCategory) {
			state.wizardComplete = true;
			state.wizardTask = 'category';
			wizard.hide();
			wizard.updateBreadcrumb('category', window.aisalesPreselectedCategory.name);
			return;
		}

		// Check localStorage for last session (optional persistence)
		const lastSession = localStorage.getItem('aisales_wizard_session');
		if (lastSession) {
			try {
				const session = JSON.parse(lastSession);
				// Only restore if it was recent (within 30 minutes)
				if (session.timestamp && (Date.now() - session.timestamp) < 30 * 60 * 1000) {
					// Don't auto-restore, just let them pick fresh
				}
			} catch (e) {
				// Ignore parse errors
			}
		}

		// Show wizard if no preselection
		wizard.show();
		wizard.bindEvents();
	};

	/**
	 * Bind wizard event handlers
	 */
	wizard.bindEvents = function() {
		const state = app.state;
		const elements = app.elements;

		// Task card selection (Step 1)
		elements.wizardCards.on('click', function() {
			const task = $(this).data('task');
			wizard.selectTask(task);
		});

		// Back button (Step 2)
		elements.wizardBack.on('click', function() {
			wizard.goToStep(1);
		});

		// Search input
		elements.wizardSearch.on('input', utils.debounce(wizard.filterItems, 200));

		// Entity item selection (delegated)
		elements.wizardItems.on('click', '.aisales-wizard__item', function() {
			const $item = $(this);
			const entityId = $item.data('id');
			const entityData = $item.data('entity');
			wizard.selectEntity(entityId, entityData);
		});

		// Breadcrumb change button
		elements.breadcrumbChange.on('click', function() {
			wizard.show();
		});

		// Setup context link in wizard
		elements.wizardSetupContext.on('click', function() {
			if (typeof app.openContextPanel === 'function') {
				app.openContextPanel();
			}
		});

		// Escape key to close wizard (if allowed)
		$(document).on('keydown.wizard', function(e) {
			if (e.key === 'Escape' && state.wizardComplete) {
				wizard.hide();
			}
		});
	};

	/**
	 * Select a task in the wizard (Step 1)
	 * @param {string} task - Task type: 'product', 'category', or 'agent'
	 */
	wizard.selectTask = function(task) {
		const state = app.state;
		const elements = app.elements;

		state.wizardTask = task;
		state.entityType = task;

		// Update legacy entity tabs for compatibility
		if (typeof app.updateEntityTabs === 'function') {
			app.updateEntityTabs();
		}

		if (task === 'agent') {
			// Agent mode skips step 2 - go directly to chat
			wizard.complete();
			if (typeof app.selectAgent === 'function') {
				app.selectAgent();
			}
		} else {
			// Go to Step 2 for product/category selection
			wizard.goToStep(2);
			wizard.populateItems();

			// Update title and subtitle based on task
			if (task === 'product') {
				elements.wizardTitle.text(aisalesChat.i18n.selectProduct || 'Select a Product');
				elements.wizardSubtitle.text(aisalesChat.i18n.selectProductHint || 'Choose a product to optimize with AI');
			} else {
				elements.wizardTitle.text(aisalesChat.i18n.selectCategory || 'Select a Category');
				elements.wizardSubtitle.text(aisalesChat.i18n.selectCategoryHint || 'Choose a category to optimize with AI');
			}
		}
	};

	/**
	 * Navigate to a specific wizard step
	 * @param {number} step - Step number (1 or 2)
	 */
	wizard.goToStep = function(step) {
		const state = app.state;
		const elements = app.elements;

		state.wizardStep = step;

		// Update step indicators
		elements.wizardSteps.each(function() {
			const $step = $(this);
			const stepNum = parseInt($step.data('step'), 10);

			$step.removeClass('aisales-wizard__step--active aisales-wizard__step--completed');

			if (stepNum < step) {
				$step.addClass('aisales-wizard__step--completed');
			} else if (stepNum === step) {
				$step.addClass('aisales-wizard__step--active');
			}
		});

		// Update panels
		elements.wizardPanels.removeClass('aisales-wizard__panel--active');
		$('.aisales-wizard__panel[data-panel="' + step + '"]').addClass('aisales-wizard__panel--active');

		// Clear search when going back
		if (step === 1) {
			elements.wizardSearch.val('');
			state.wizardTask = null;
		}
	};

	/**
	 * Populate wizard items list (Step 2)
	 */
	wizard.populateItems = function() {
		const state = app.state;
		const elements = app.elements;
		const $container = elements.wizardItems;
		const isProduct = state.wizardTask === 'product';
		const items = isProduct ? state.products : state.categories;

		// Show loading skeleton first
		wizard.showLoadingSkeleton();

		// Simulate brief loading for smoother UX (items are already loaded, but skeleton looks better)
		setTimeout(function() {
			$container.empty();

			// Remove any existing results count
			$('.aisales-wizard__results-count').remove();

			if (!items || items.length === 0) {
				// Enhanced empty state
				const emptyIcon = isProduct ? 'dashicons-products' : 'dashicons-category';
				const emptyTitle = isProduct
					? (aisalesChat.i18n.noProductsTitle || 'No products yet')
					: (aisalesChat.i18n.noCategoriesTitle || 'No categories yet');
				const emptyText = isProduct
					? (aisalesChat.i18n.noProductsText || 'Create your first product to start optimizing with AI.')
					: (aisalesChat.i18n.noCategoriesText || 'Create categories to organize your products.');
				const emptyAction = isProduct
					? (aisalesChat.i18n.createProduct || 'Create Product')
					: (aisalesChat.i18n.createCategory || 'Create Category');
				const emptyUrl = isProduct
					? (aisalesChat.urls?.newProduct || 'post-new.php?post_type=product')
					: (aisalesChat.urls?.newCategory || 'edit-tags.php?taxonomy=product_cat&post_type=product');

				$container.html(
					'<div class="aisales-wizard__empty">' +
						'<div class="aisales-wizard__empty-icon">' +
							'<span class="dashicons ' + emptyIcon + '"></span>' +
						'</div>' +
						'<h4 class="aisales-wizard__empty-title">' + utils.escapeHtml(emptyTitle) + '</h4>' +
						'<p class="aisales-wizard__empty-text">' + utils.escapeHtml(emptyText) + '</p>' +
						'<a href="' + utils.escapeHtml(emptyUrl) + '" class="aisales-wizard__empty-action">' +
							'<span class="dashicons dashicons-plus-alt2"></span>' +
							utils.escapeHtml(emptyAction) +
						'</a>' +
					'</div>'
				);
				return;
			}

			// Populate items
			items.forEach(function(item) {
				const $item = wizard.createItem(item);
				$container.append($item);
			});

			// Check for scroll overflow to show fade gradient
			wizard.checkItemsOverflow();

		}, 150); // Brief delay for skeleton visibility
	};

	/**
	 * Show loading skeleton in wizard items
	 */
	wizard.showLoadingSkeleton = function() {
		const $container = app.elements.wizardItems;
		$container.empty();

		// Generate 4 skeleton items
		for (var i = 0; i < 4; i++) {
			$container.append(
				'<div class="aisales-wizard__skeleton">' +
					'<div class="aisales-wizard__skeleton-image"></div>' +
					'<div class="aisales-wizard__skeleton-content">' +
						'<div class="aisales-wizard__skeleton-line aisales-wizard__skeleton-line--title"></div>' +
						'<div class="aisales-wizard__skeleton-line aisales-wizard__skeleton-line--meta"></div>' +
					'</div>' +
				'</div>'
			);
		}
	};

	/**
	 * Check if wizard items container has overflow (to show fade gradient)
	 */
	wizard.checkItemsOverflow = function() {
		const elements = app.elements;
		const $wrapper = elements.wizardItems.parent();
		const container = elements.wizardItems[0];

		if (container && container.scrollHeight > container.clientHeight) {
			$wrapper.addClass('has-overflow');
		} else {
			$wrapper.removeClass('has-overflow');
		}

		// Update on scroll
		elements.wizardItems.off('scroll.wizardOverflow').on('scroll.wizardOverflow', function() {
			const scrollBottom = container.scrollHeight - container.scrollTop - container.clientHeight;
			if (scrollBottom < 10) {
				$wrapper.removeClass('has-overflow');
			} else {
				$wrapper.addClass('has-overflow');
			}
		});
	};

	/**
	 * Create a wizard item element
	 * @param {Object} item - Entity data (product or category)
	 * @returns {jQuery} Item element
	 */
	wizard.createItem = function(item) {
		const state = app.state;
		const isProduct = state.wizardTask === 'product';
		const name = isProduct ? item.title : item.name;
		const image = isProduct ? item.image : (item.thumbnail || '');
		const subtitle = isProduct
			? (item.price ? item.price : '')
			: (item.count !== undefined ? item.count + ' ' + (item.count === 1 ? 'product' : 'products') : '');

		// Handle category depth indentation via CSS margin instead of HTML entities
		const depthClass = (!isProduct && item.depth) ? ' aisales-wizard__item--depth-' + Math.min(item.depth, 3) : '';

		const $item = $('<button type="button" class="aisales-wizard__item' + depthClass + '">')
			.data('id', item.id)
			.data('entity', item)
			.data('name', name); // Store name for search highlighting

		// Image/icon with task-aware variant
		if (image) {
			$item.append('<img class="aisales-wizard__item-image" src="' + utils.escapeHtml(image) + '" alt="">');
		} else {
			const icon = isProduct ? 'dashicons-products' : 'dashicons-category';
			const iconVariant = isProduct ? 'aisales-wizard__item-icon--product' : 'aisales-wizard__item-icon--category';
			$item.append('<span class="aisales-wizard__item-icon ' + iconVariant + '"><span class="dashicons ' + icon + '"></span></span>');
		}

		// Content
		const $content = $('<div class="aisales-wizard__item-content">');
		$content.append('<span class="aisales-wizard__item-name">' + utils.escapeHtml(name) + '</span>');

		if (subtitle) {
			// Add icon prefix to meta
			const metaIcon = isProduct ? 'dashicons-tag' : 'dashicons-archive';
			$content.append(
				'<span class="aisales-wizard__item-meta">' +
					'<span class="dashicons ' + metaIcon + '"></span>' +
					utils.escapeHtml(subtitle) +
				'</span>'
			);
		}
		$item.append($content);

		// Arrow
		$item.append('<span class="aisales-wizard__item-arrow"><span class="dashicons dashicons-arrow-right-alt2"></span></span>');

		return $item;
	};

	/**
	 * Filter wizard items based on search
	 */
	wizard.filterItems = function() {
		const state = app.state;
		const elements = app.elements;
		const query = elements.wizardSearch.val().toLowerCase().trim();
		const $items = elements.wizardItems.find('.aisales-wizard__item');
		const isProduct = state.wizardTask === 'product';

		// Remove existing results count
		$('.aisales-wizard__results-count').remove();
		$('.aisales-wizard__no-results').remove();

		if (!query) {
			// Show all items, restore original names (remove highlight)
			$items.each(function() {
				const $item = $(this);
				const originalName = $item.data('name');
				$item.find('.aisales-wizard__item-name').html(utils.escapeHtml(originalName));
			});
			$items.show();
			wizard.checkItemsOverflow();
			return;
		}

		var visibleCount = 0;

		$items.each(function() {
			const $item = $(this);
			const entity = $item.data('entity');
			const name = (isProduct ? entity.title : entity.name) || '';
			const nameLower = name.toLowerCase();
			const matches = nameLower.indexOf(query) !== -1;

			if (matches) {
				visibleCount++;
				$item.show();

				// Highlight matching text
				const highlightedName = utils.highlightSearchMatch(name, query);
				$item.find('.aisales-wizard__item-name').html(highlightedName);
			} else {
				$item.hide();
				// Restore original name
				$item.find('.aisales-wizard__item-name').html(utils.escapeHtml(name));
			}
		});

		// Show results count or no results message
		if (visibleCount > 0) {
			const itemType = isProduct
				? (visibleCount === 1 ? 'product' : 'products')
				: (visibleCount === 1 ? 'category' : 'categories');
			const resultsHtml =
				'<div class="aisales-wizard__results-count">' +
					'<span class="dashicons dashicons-search"></span>' +
					visibleCount + ' ' + itemType + ' found' +
				'</div>';
			elements.wizardItems.prepend(resultsHtml);
		} else {
			const noResultsHtml =
				'<div class="aisales-wizard__no-results">' +
					'<div class="aisales-wizard__no-results-icon">&#128269;</div>' +
					'<p class="aisales-wizard__no-results-text">' +
						'No ' + (isProduct ? 'products' : 'categories') + ' match "<strong>' + utils.escapeHtml(query) + '</strong>"' +
					'</p>' +
				'</div>';
			elements.wizardItems.append(noResultsHtml);
		}

		wizard.checkItemsOverflow();
	};

	/**
	 * Select an entity from the wizard (complete Step 2)
	 * @param {number|string} entityId - Entity ID
	 * @param {Object} entityData - Entity data object
	 */
	wizard.selectEntity = function(entityId, entityData) {
		const state = app.state;

		if (state.wizardTask === 'product') {
			if (typeof app.selectProduct === 'function') {
				app.selectProduct(entityData);
			}
			wizard.updateBreadcrumb('product', entityData.title);
		} else {
			if (typeof app.selectCategory === 'function') {
				app.selectCategory(entityData);
			}
			wizard.updateBreadcrumb('category', entityData.name);
		}

		// Save to localStorage for session persistence
		localStorage.setItem('aisales_wizard_session', JSON.stringify({
			task: state.wizardTask,
			entityId: entityId,
			timestamp: Date.now()
		}));

		wizard.complete();
	};

	/**
	 * Complete the wizard and show the chat interface
	 */
	wizard.complete = function() {
		const state = app.state;
		const elements = app.elements;

		state.wizardComplete = true;
		state.wizardStep = 3;

		// Update step indicators to show completion
		elements.wizardSteps.each(function() {
			const $step = $(this);
			const stepNum = parseInt($step.data('step'), 10);
			$step.removeClass('aisales-wizard__step--active');
			if (stepNum <= 3) {
				$step.addClass('aisales-wizard__step--completed');
			}
		});

		// Hide wizard with animation
		wizard.hide();

		// Show breadcrumb
		if (state.wizardTask !== 'agent') {
			elements.breadcrumb.show();
		}
	};

	/**
	 * Show the wizard overlay
	 */
	wizard.show = function() {
		const state = app.state;
		const elements = app.elements;

		// Reset to step 1 if starting fresh
		if (!state.wizardTask) {
			wizard.goToStep(1);
		}

		elements.wizard.show();
		elements.breadcrumb.hide();

		// Focus search if on step 2
		if (state.wizardStep === 2) {
			setTimeout(function() {
				elements.wizardSearch.focus();
			}, 100);
		}
	};

	/**
	 * Hide the wizard overlay
	 */
	wizard.hide = function() {
		const state = app.state;
		const elements = app.elements;

		elements.wizard.hide();

		// Show breadcrumb if wizard was completed
		if (state.wizardComplete && state.wizardTask !== 'agent') {
			elements.breadcrumb.show();
		}
	};

	/**
	 * Update the breadcrumb display
	 * @param {string} type - Entity type: 'product', 'category', or 'agent'
	 * @param {string} name - Entity name
	 */
	wizard.updateBreadcrumb = function(type, name) {
		const elements = app.elements;

		const typeLabels = {
			'product': aisalesChat.i18n.product || 'Product',
			'category': aisalesChat.i18n.category || 'Category',
			'agent': aisalesChat.i18n.agent || 'Marketing Agent'
		};

		elements.breadcrumbType.text(typeLabels[type] || type);
		elements.breadcrumbName.text(name || '');

		if (type === 'agent') {
			elements.breadcrumb.hide();
		}
	};

	/**
	 * Reset wizard to initial state (for New Chat)
	 */
	wizard.reset = function() {
		const state = app.state;
		const elements = app.elements;

		state.wizardStep = 1;
		state.wizardTask = null;
		state.wizardComplete = false;

		// Reset step indicators
		elements.wizardSteps.removeClass('aisales-wizard__step--active aisales-wizard__step--completed');
		$('.aisales-wizard__step[data-step="1"]').addClass('aisales-wizard__step--active');

		// Reset panels
		elements.wizardPanels.removeClass('aisales-wizard__panel--active');
		$('.aisales-wizard__panel[data-panel="1"]').addClass('aisales-wizard__panel--active');

		// Clear search
		elements.wizardSearch.val('');
		elements.wizardItems.empty();

		// Clear localStorage
		localStorage.removeItem('aisales_wizard_session');

		// Hide breadcrumb
		elements.breadcrumb.hide();
	};

	// Expose for backward compatibility
	window.AISalesChat.initWizard = wizard.init;
	window.AISalesChat.resetWizard = wizard.reset;
	window.AISalesChat.showWizard = wizard.show;
	window.AISalesChat.hideWizard = wizard.hide;

})(jQuery);
