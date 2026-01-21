/**
 * AI Sales Chat - Panels Module
 * Handles product, category, and agent panel updates
 */
(function($) {
	'use strict';

	// Get app reference
	var app = window.AISalesChat = window.AISalesChat || {};

	/**
	 * Panels module
	 */
	var panels = {
		/**
		 * Update product info panel
		 * @param {Object} product - Product data
		 */
		updateProductPanel: function(product) {
			var elements = app.elements;
			var formatting = app.formatting;
			var escapeHtml = formatting.escapeHtml.bind(formatting);

			elements.entityEmpty.hide();
			elements.productInfo.show();

			// Image
			var $image = $('#aisales-product-image');
			if (product.image_url) {
				$image.attr('src', product.image_url).show();
			} else {
				$image.hide();
			}

			// Title
			$('#aisales-product-title').text(product.title || '');

			// Description
			var desc = product.description || '';
			$('#aisales-product-description').html(desc.substring(0, 200) + (desc.length > 200 ? '...' : ''));

			// Short description
			$('#aisales-product-short-description').text(product.short_description || '');

			// Categories
			var categories = product.categories || [];
			if (categories.length > 0) {
				$('#aisales-product-categories').html(
					categories.map(function(cat) {
						return '<span class="aisales-tag">' + escapeHtml(cat) + '</span>';
					}).join('')
				);
			} else {
				$('#aisales-product-categories').html('<span class="aisales-no-value">' + (aisalesChat.i18n.none || 'None') + '</span>');
			}

			// Tags
			var tags = product.tags || [];
			if (tags.length > 0) {
				$('#aisales-product-tags').html(
					tags.map(function(tag) {
						return '<span class="aisales-tag">' + escapeHtml(tag) + '</span>';
					}).join('')
				);
			} else {
				$('#aisales-product-tags').html('<span class="aisales-no-value">' + (aisalesChat.i18n.none || 'None') + '</span>');
			}

			// Price
			var priceHtml = formatting.formatPrice(product.regular_price, product.sale_price, product.price);
			$('#aisales-product-price').html(priceHtml);

			// Stock
			var stockHtml = formatting.formatStock(product.stock_status, product.stock_quantity);
			$('#aisales-product-stock').html(stockHtml);

			// Status
			$('#aisales-product-status').html(formatting.formatStatus(product.status));

			// Edit/View links
			$('#aisales-edit-product').attr('href', product.edit_url || '#');
			$('#aisales-view-product').attr('href', product.view_url || '#');

			// Set selected in dropdown
			elements.entitySelect.val(product.id);
		},

		/**
		 * Update category info panel
		 * @param {Object} category - Category data
		 */
		updateCategoryPanel: function(category) {
			var elements = app.elements;
			var escapeHtml = app.formatting.escapeHtml.bind(app.formatting);

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
			var desc = category.description || '';
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
			var subcats = category.subcategories || [];
			if (subcats.length > 0) {
				$('#aisales-category-subcategories').html(
					subcats.map(function(sub) {
						return '<span class="aisales-subcat-tag"><span class="dashicons dashicons-category"></span>' + escapeHtml(sub.name) + '</span>';
					}).join('')
				);
			} else {
				$('#aisales-category-subcategories').html('<span class="aisales-no-value">' + (aisalesChat.i18n.none || 'None') + '</span>');
			}

			// Edit/View links
			$('#aisales-edit-category').attr('href', category.edit_url || '#');
			$('#aisales-view-category').attr('href', category.view_url || '#');

			// Set selected in dropdown
			elements.entitySelect.val(category.id);
		},

		/**
		 * Update agent info panel
		 * Shows the marketing agent panel
		 */
		updateAgentPanel: function() {
			var elements = app.elements;

			elements.entityEmpty.hide();
			elements.productInfo.hide();
			elements.categoryInfo.hide();
			elements.agentInfo.show();

			// Update agent-specific UI elements if needed
			$('#aisales-agent-status').text('Active');
		},

		/**
		 * Select and display a product
		 * @param {Object} product - Product data
		 */
		selectProduct: function(product) {
			var state = app.state;

			state.selectedProduct = product;
			state.selectedCategory = null;
			state.isAgentMode = false;
			state.entityType = 'product';

			this.updateProductPanel(product);
			app.elements.categoryInfo.hide();
			app.elements.agentInfo.hide();

			// Enable quick actions
			$('.aisales-product-quick-actions button[data-action]').prop('disabled', false);
		},

		/**
		 * Select and display a category
		 * @param {Object} category - Category data
		 */
		selectCategory: function(category) {
			var state = app.state;

			state.selectedCategory = category;
			state.selectedProduct = null;
			state.isAgentMode = false;
			state.entityType = 'category';

			this.updateCategoryPanel(category);
			app.elements.productInfo.hide();
			app.elements.agentInfo.hide();

			// Enable quick actions
			$('.aisales-category-quick-actions button[data-action]').prop('disabled', false);
		},

		/**
		 * Select agent mode
		 */
		selectAgent: function() {
			var state = app.state;

			state.selectedProduct = null;
			state.selectedCategory = null;
			state.isAgentMode = true;
			state.entityType = 'agent';

			this.updateAgentPanel();
			app.elements.productInfo.hide();
			app.elements.categoryInfo.hide();

			// Enable quick actions
			$('.aisales-agent-quick-actions button[data-action]').prop('disabled', false);
		},

		/**
		 * Clear entity selection
		 */
		clearEntity: function() {
			var state = app.state;
			var elements = app.elements;

			state.selectedProduct = null;
			state.selectedCategory = null;
			state.isAgentMode = false;

			elements.productInfo.hide();
			elements.categoryInfo.hide();
			elements.agentInfo.hide();
			elements.entityEmpty.show();

			// Disable inputs
			if (app.disableInputs) {
				app.disableInputs();
			}

			// Show welcome
			if (app.showWelcomeMessage) {
				app.showWelcomeMessage();
			}
		},

		/**
		 * Clear product selection
		 */
		clearProduct: function() {
			var state = app.state;
			var elements = app.elements;

			state.selectedProduct = null;
			elements.productInfo.hide();
			elements.entityEmpty.show();
			elements.entitySelect.val('');

			$('.aisales-product-quick-actions button[data-action]').prop('disabled', true);
		},

		/**
		 * Clear category selection
		 */
		clearCategory: function() {
			var state = app.state;
			var elements = app.elements;

			state.selectedCategory = null;
			elements.categoryInfo.hide();
			elements.entityEmpty.show();
			elements.entitySelect.val('');

			$('.aisales-category-quick-actions button[data-action]').prop('disabled', true);
		},

		/**
		 * Clear agent mode
		 */
		clearAgent: function() {
			var state = app.state;
			var elements = app.elements;

			state.isAgentMode = false;
			elements.agentInfo.hide();
			elements.entityEmpty.show();

			$('.aisales-agent-quick-actions button[data-action]').prop('disabled', true);
		}
	};

	// Expose module
	app.panels = panels;

	// Expose individual functions for backward compatibility
	window.AISalesChat.updateProductPanel = panels.updateProductPanel.bind(panels);
	window.AISalesChat.updateCategoryPanel = panels.updateCategoryPanel.bind(panels);
	window.AISalesChat.selectProduct = panels.selectProduct.bind(panels);
	window.AISalesChat.selectCategory = panels.selectCategory.bind(panels);
	window.AISalesChat.selectAgent = panels.selectAgent.bind(panels);
	window.AISalesChat.clearEntity = panels.clearEntity.bind(panels);
	window.AISalesChat.clearProduct = panels.clearProduct.bind(panels);
	window.AISalesChat.clearCategory = panels.clearCategory.bind(panels);
	window.AISalesChat.clearAgent = panels.clearAgent.bind(panels);

})(jQuery);
