/**
 * AISales Chat - Entities Module
 * Handles entity selection, panels, tabs for products/categories/agent
 *
 * @package AISales_Sales_Manager
 */

(function($) {
	'use strict';

	const app = window.AISalesChat = window.AISalesChat || {};
	const utils = app.utils;

	/**
	 * Entities namespace
	 */
	const entities = app.entities = {};

	// Get utility functions
	const escapeHtml = utils ? utils.escapeHtml : function(str) {
		if (!str) return '';
		return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
	};
	const formatPrice = utils ? utils.formatPrice : function() { return ''; };
	const formatStock = utils ? utils.formatStock : function() { return ''; };
	const formatStatus = utils ? utils.formatStatus : function() { return ''; };

	/**
	 * Initialize entities functionality
	 */
	entities.init = function() {
		entities.bindEvents();
	};

	/**
	 * Bind entity-related event handlers
	 */
	entities.bindEvents = function() {
		const elements = app.elements;

		// Entity type tabs
		elements.entityTabs.on('click', '.aisales-entity-tab', entities.handleTabClick);

		// Entity selection dropdown
		elements.entitySelect.on('change', entities.handleSelectChange);

		// Expand toggle for description
		elements.entityPanel.on('click', '.aisales-expand-toggle', entities.handleExpandToggle);
	};

	/**
	 * Handle entity tab click (switch between Products/Categories/Agent)
	 * @param {Event} e - Click event
	 */
	entities.handleTabClick = function(e) {
		const state = app.state;
		const $tab = $(e.currentTarget);
		const newType = $tab.data('type');

		if (newType === state.entityType) return;

		// Switch entity type
		state.entityType = newType;
		state.isAgentMode = (newType === 'agent');

		// Update tabs UI
		entities.updateTabs();

		// Clear current selection (skip for agent - selectAgent handles cleanup)
		if (newType !== 'agent') {
			entities.clear();
		}

		// Populate selector with new entity type (or hide for agent)
		entities.populateSelector();

		// Update quick actions visibility
		entities.updateQuickActionsVisibility();

		// Update empty state text and icon
		entities.updateEmptyState();

		// If agent mode, activate immediately
		if (state.entityType === 'agent') {
			entities.selectAgent();
		}
	};

	/**
	 * Update entity tabs UI
	 */
	entities.updateTabs = function() {
		const elements = app.elements;
		const state = app.state;
		elements.entityTabs.find('.aisales-entity-tab').removeClass('aisales-entity-tab--active');
		elements.entityTabs.find('[data-type="' + state.entityType + '"]').addClass('aisales-entity-tab--active');
	};

	/**
	 * Update quick actions visibility based on entity type
	 */
	entities.updateQuickActionsVisibility = function() {
		const elements = app.elements;
		const state = app.state;

		elements.quickActionsProduct.hide();
		elements.quickActionsCategory.hide();
		elements.quickActionsAgent.hide();

		if (state.entityType === 'agent') {
			elements.quickActionsAgent.show();
		} else if (state.entityType === 'category') {
			elements.quickActionsCategory.show();
		} else {
			elements.quickActionsProduct.show();
		}
	};

	/**
	 * Update empty state text and icon
	 */
	entities.updateEmptyState = function() {
		const state = app.state;
		const $icon = $('#aisales-empty-icon');
		const $text = $('#aisales-empty-text');

		if (state.entityType === 'agent') {
			$icon.attr('class', 'dashicons dashicons-superhero-alt');
			$text.text(aisalesChat.i18n.agentReady || 'AI Agent ready to help with marketing');
		} else if (state.entityType === 'category') {
			$icon.attr('class', 'dashicons dashicons-category');
			$text.text(aisalesChat.i18n.selectCategory || 'Select a category to view details');
		} else {
			$icon.attr('class', 'dashicons dashicons-products');
			$text.text(aisalesChat.i18n.selectProduct || 'Select a product to view details');
		}
	};

	/**
	 * Handle entity selection change
	 */
	entities.handleSelectChange = function() {
		const elements = app.elements;
		const state = app.state;
		const entityId = elements.entitySelect.val();

		if (!entityId) {
			entities.clear();
			return;
		}

		const $selected = elements.entitySelect.find(':selected');

		if (state.entityType === 'category') {
			const categoryData = $selected.data('category');
			if (categoryData) {
				entities.selectCategory(categoryData);
			}
		} else {
			const productData = $selected.data('product');
			if (productData) {
				entities.selectProduct(productData);
			}
		}
	};

	/**
	 * Populate entity selector based on current entity type
	 */
	entities.populateSelector = function() {
		const state = app.state;
		const elements = app.elements;

		if (state.entityType === 'agent') {
			// Agent mode doesn't need entity selector
			elements.entitySelect.empty().hide();
			return;
		}

		elements.entitySelect.show();

		if (state.entityType === 'category') {
			entities.populateCategorySelector();
		} else {
			entities.populateProductSelector();
		}
	};

	/**
	 * Populate product selector dropdown
	 */
	entities.populateProductSelector = function() {
		const state = app.state;
		const $select = app.elements.entitySelect;
		$select.empty();
		$select.append($('<option>', {
			value: '',
			text: aisalesChat.i18n.selectProduct
		}));

		if (state.products.length === 0) {
			$select.append($('<option>', {
				value: '',
				text: aisalesChat.i18n.noProducts,
				disabled: true
			}));
			return;
		}

		state.products.forEach(function(product) {
			$select.append($('<option>', {
				value: product.id,
				text: product.title,
				'data-product': JSON.stringify(product)
			}));
		});
	};

	/**
	 * Populate category selector dropdown
	 */
	entities.populateCategorySelector = function() {
		const state = app.state;
		const $select = app.elements.entitySelect;
		$select.empty();
		$select.append($('<option>', {
			value: '',
			text: aisalesChat.i18n.selectCategory || 'Select a category...'
		}));

		if (state.categories.length === 0) {
			$select.append($('<option>', {
				value: '',
				text: aisalesChat.i18n.noCategories || 'No categories found',
				disabled: true
			}));
			return;
		}

		state.categories.forEach(function(category) {
			const indent = '— '.repeat(category.depth || 0);
			$select.append($('<option>', {
				value: category.id,
				text: indent + category.name,
				'data-category': JSON.stringify(category)
			}));
		});
	};

	/**
	 * Select a product and create/load session
	 * @param {Object} product - Product data
	 */
	entities.selectProduct = function(product) {
		const state = app.state;
		const elements = app.elements;

		state.selectedProduct = product;
		state.selectedCategory = null;
		state.isAgentMode = false;
		entities.updateProductPanel(product);

		if (typeof app.enableInputs === 'function') {
			app.enableInputs();
		}

		// Hide welcome, show product info
		elements.chatWelcome.hide();
		elements.entityEmpty.hide();
		elements.productInfo.show();
		elements.categoryInfo.hide();
		elements.agentInfo.hide();

		// Create new session for this product
		if (typeof app.createSession === 'function') {
			app.createSession(product, 'product');
		}
	};

	/**
	 * Select a category and create/load session
	 * @param {Object} category - Category data
	 */
	entities.selectCategory = function(category) {
		const state = app.state;
		const elements = app.elements;

		state.selectedCategory = category;
		state.selectedProduct = null;
		state.isAgentMode = false;
		entities.updateCategoryPanel(category);

		if (typeof app.enableInputs === 'function') {
			app.enableInputs();
		}

		// Hide welcome, show category info
		elements.chatWelcome.hide();
		elements.entityEmpty.hide();
		elements.productInfo.hide();
		elements.categoryInfo.show();
		elements.agentInfo.hide();

		// Create new session for this category
		if (typeof app.createSession === 'function') {
			app.createSession(category, 'category');
		}
	};

	/**
	 * Select agent mode (store-wide marketing operations)
	 */
	entities.selectAgent = function() {
		const state = app.state;
		const elements = app.elements;

		// Clear previous state
		state.selectedProduct = null;
		state.selectedCategory = null;
		state.sessionId = null;
		state.messages = [];
		state.pendingSuggestions = {};
		state.isAgentMode = true;

		// Clear messages display
		if (typeof app.clearMessages === 'function') {
			app.clearMessages();
		}

		// Enable inputs for agent mode
		if (typeof app.enableInputs === 'function') {
			app.enableInputs();
		}

		// Hide welcome and other panels, show agent info
		elements.chatWelcome.hide();
		elements.entityEmpty.hide();
		elements.productInfo.hide();
		elements.categoryInfo.hide();
		elements.agentInfo.show();
		elements.pendingSummary.hide();

		// Create new session for agent mode
		if (typeof app.createSession === 'function') {
			app.createSession(null, 'agent');
		}
	};

	/**
	 * Load and select a category by ID
	 * @param {number|string} categoryId - Category ID
	 */
	entities.loadAndSelectCategory = function(categoryId) {
		const state = app.state;
		// Find category in state
		const category = state.categories.find(c => c.id == categoryId);
		if (category) {
			app.elements.entitySelect.val(categoryId);
			entities.selectCategory(category);
		} else {
			// Fetch category data via AJAX
			$.ajax({
				url: aisalesChat.ajaxUrl,
				method: 'POST',
				data: {
					action: 'aisales_get_category',
					nonce: aisalesChat.nonce,
					category_id: categoryId
				},
				success: function(response) {
					if (response.success && response.data) {
						entities.selectCategory(response.data);
					}
				}
			});
		}
	};

	/**
	 * Clear entity selection
	 */
	entities.clear = function() {
		const state = app.state;
		if (state.entityType === 'agent') {
			entities.clearAgent();
		} else if (state.entityType === 'category') {
			entities.clearCategory();
		} else {
			entities.clearProduct();
		}
	};

	/**
	 * Clear product selection
	 */
	entities.clearProduct = function() {
		const state = app.state;
		const elements = app.elements;

		state.selectedProduct = null;
		state.sessionId = null;
		state.messages = [];
		state.pendingSuggestions = {};

		elements.productInfo.hide();
		elements.entityEmpty.show();
		elements.pendingSummary.hide();

		if (typeof app.disableInputs === 'function') {
			app.disableInputs();
		}
		if (typeof app.showWelcomeMessage === 'function') {
			app.showWelcomeMessage();
		}
	};

	/**
	 * Clear category selection
	 */
	entities.clearCategory = function() {
		const state = app.state;
		const elements = app.elements;

		state.selectedCategory = null;
		state.sessionId = null;
		state.messages = [];
		state.pendingSuggestions = {};

		elements.categoryInfo.hide();
		elements.entityEmpty.show();
		elements.categoryPendingSummary.hide();

		if (typeof app.disableInputs === 'function') {
			app.disableInputs();
		}
		if (typeof app.showWelcomeMessage === 'function') {
			app.showWelcomeMessage();
		}
	};

	/**
	 * Clear agent mode
	 */
	entities.clearAgent = function() {
		const state = app.state;
		const elements = app.elements;

		state.isAgentMode = false;
		state.sessionId = null;
		state.messages = [];
		state.pendingSuggestions = {};

		elements.agentInfo.hide();
		elements.entityEmpty.show();

		if (typeof app.disableInputs === 'function') {
			app.disableInputs();
		}
		if (typeof app.showWelcomeMessage === 'function') {
			app.showWelcomeMessage();
		}
	};

	/**
	 * Update product info panel
	 * @param {Object} product - Product data
	 */
	entities.updateProductPanel = function(product) {
		const elements = app.elements;

		elements.entityEmpty.hide();
		elements.productInfo.show();

		// Image
		const $image = $('#aisales-product-image');
		if (product.image_url) {
			$image.attr('src', product.image_url).show();
		} else {
			$image.hide();
		}

		// Title
		$('#aisales-product-title').text(product.title || '');

		// Description
		const desc = product.description || '';
		$('#aisales-product-description').html(desc.substring(0, 200) + (desc.length > 200 ? '...' : ''));

		// Short description
		$('#aisales-product-short-description').text(product.short_description || '');

		// Categories
		const categories = product.categories || [];
		if (categories.length > 0) {
			$('#aisales-product-categories').html(
				categories.map(cat => '<span class="aisales-tag">' + escapeHtml(cat) + '</span>').join('')
			);
		} else {
			$('#aisales-product-categories').html('<span class="aisales-no-value">' + (aisalesChat.i18n.none || 'None') + '</span>');
		}

		// Tags
		const tags = product.tags || [];
		if (tags.length > 0) {
			$('#aisales-product-tags').html(
				tags.map(tag => '<span class="aisales-tag">' + escapeHtml(tag) + '</span>').join('')
			);
		} else {
			$('#aisales-product-tags').html('<span class="aisales-no-value">' + (aisalesChat.i18n.none || 'None') + '</span>');
		}

		// Price
		const priceHtml = formatPrice(product.regular_price, product.sale_price, product.price);
		$('#aisales-product-price').html(priceHtml);

		// Stock
		const stockHtml = formatStock(product.stock_status, product.stock_quantity);
		$('#aisales-product-stock').html(stockHtml);

		// Status
		$('#aisales-product-status').html(formatStatus(product.status));

		// Edit/View links
		$('#aisales-edit-product').attr('href', product.edit_url || '#');
		$('#aisales-view-product').attr('href', product.view_url || '#');

		// Set selected in dropdown
		elements.entitySelect.val(product.id);
	};

	/**
	 * Update category info panel
	 * @param {Object} category - Category data
	 */
	entities.updateCategoryPanel = function(category) {
		const elements = app.elements;

		elements.entityEmpty.hide();
		elements.categoryInfo.show();

		// Name
		$('#aisales-category-name').text(category.name || '');
		$('#aisales-category-name-value').text(category.name || '');

		// Parent
		if (category.parent_name) {
			$('#aisales-category-parent').text('in ' + category.parent_name).show();
		} else {
			$('#aisales-category-parent').hide();
		}

		// Stats
		$('#aisales-category-product-count').text(category.product_count || 0);
		$('#aisales-category-subcat-count').text(category.subcategory_count || 0);

		// Description
		const desc = category.description || '';
		if (desc) {
			$('#aisales-category-description').html(desc.substring(0, 200) + (desc.length > 200 ? '...' : ''));
		} else {
			$('#aisales-category-description').html('<span class="aisales-no-value">' + (aisalesChat.i18n.noDescription || 'No description') + '</span>');
		}

		// SEO Title
		if (category.seo_title) {
			$('#aisales-category-seo-title').text(category.seo_title);
		} else {
			$('#aisales-category-seo-title').html('<span class="aisales-no-value">' + (aisalesChat.i18n.notSet || 'Not set') + '</span>');
		}

		// Meta Description
		if (category.meta_description) {
			$('#aisales-category-meta-description').text(category.meta_description);
		} else {
			$('#aisales-category-meta-description').html('<span class="aisales-no-value">' + (aisalesChat.i18n.notSet || 'Not set') + '</span>');
		}

		// Subcategories
		const subcats = category.subcategories || [];
		if (subcats.length > 0) {
			$('#aisales-category-subcategories').html(
				subcats.map(sub => '<span class="aisales-subcat-tag"><span class="dashicons dashicons-category"></span>' + escapeHtml(sub.name) + '</span>').join('')
			);
		} else {
			$('#aisales-category-subcategories').html('<span class="aisales-no-value">' + (aisalesChat.i18n.none || 'None') + '</span>');
		}

		// Edit/View links
		$('#aisales-edit-category').attr('href', category.edit_url || '#');
		$('#aisales-view-category').attr('href', category.view_url || '#');

		// Set selected in dropdown
		elements.entitySelect.val(category.id);
	};

	/**
	 * Handle expand toggle for description fields
	 * @param {Event} e - Click event
	 */
	entities.handleExpandToggle = function(e) {
		var $toggle = $(e.currentTarget);
		var $field = $toggle.closest('.aisales-product-info__field, .aisales-category-info__field');
		var isExpanded = $field.hasClass('aisales-product-info__field--expanded') || $field.hasClass('aisales-category-info__field--expanded');

		$field.toggleClass('aisales-product-info__field--expanded aisales-category-info__field--expanded');
		$field.find('.aisales-product-info__value, .aisales-category-info__value').toggleClass('aisales-product-info__value--truncated aisales-category-info__value--truncated');

		$toggle.text(isExpanded ? 'Show more' : 'Show less');
	};

	// Expose for backward compatibility
	window.AISalesChat.selectProduct = entities.selectProduct;
	window.AISalesChat.selectCategory = entities.selectCategory;
	window.AISalesChat.selectAgent = entities.selectAgent;
	window.AISalesChat.updateEntityTabs = entities.updateTabs;
	window.AISalesChat.populateEntitySelector = entities.populateSelector;
	window.AISalesChat.loadAndSelectCategory = entities.loadAndSelectCategory;

})(jQuery);
