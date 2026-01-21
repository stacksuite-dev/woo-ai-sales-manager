/**
 * AI Sales Chat - Formatting Module
 * Handles text formatting, escaping, and display formatting
 */
(function($) {
	'use strict';

	// Get app reference
	var app = window.AISalesChat = window.AISalesChat || {};

	/**
	 * Formatting module
	 */
	var formatting = {
		/**
		 * Escape HTML special characters
		 * @param {string} str - String to escape
		 * @returns {string} Escaped string
		 */
		escapeHtml: function(str) {
			if (!str) return '';
			return str
				.replace(/&/g, '&amp;')
				.replace(/</g, '&lt;')
				.replace(/>/g, '&gt;')
				.replace(/"/g, '&quot;')
				.replace(/'/g, '&#039;');
		},

		/**
		 * Truncate string to specified length
		 * @param {string} str - String to truncate
		 * @param {number} len - Maximum length
		 * @returns {string} Truncated string
		 */
		truncate: function(str, len) {
			if (!str) return '';
			return str.length > len ? str.substring(0, len) + '...' : str;
		},

		/**
		 * Format number with commas
		 * @param {number} num - Number to format
		 * @returns {string} Formatted number
		 */
		numberFormat: function(num) {
			return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
		},

		/**
		 * Format time from ISO string
		 * @param {string} isoString - ISO date string
		 * @returns {string} Formatted time
		 */
		formatTime: function(isoString) {
			if (!isoString) return '';
			var date = new Date(isoString);
			return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
		},

		/**
		 * Format price display
		 * @param {string|number} regularPrice - Regular price
		 * @param {string|number} salePrice - Sale price
		 * @param {string|number} price - Current price
		 * @returns {string} Formatted price HTML
		 */
		formatPrice: function(regularPrice, salePrice, price) {
			if (!price && !regularPrice) return '<span class="aisales-no-value">Not set</span>';

			if (salePrice && regularPrice && salePrice !== regularPrice) {
				return '<del>' + this.formatCurrency(regularPrice) + '</del> ' + this.formatCurrency(salePrice);
			}

			return this.formatCurrency(price || regularPrice);
		},

		/**
		 * Format currency
		 * @param {string|number} amount - Amount to format
		 * @returns {string} Formatted currency
		 */
		formatCurrency: function(amount) {
			if (!amount) return '';
			var num = parseFloat(amount);
			return isNaN(num) ? amount : '$' + num.toFixed(2);
		},

		/**
		 * Format stock display
		 * @param {string} status - Stock status
		 * @param {number} quantity - Stock quantity
		 * @returns {string} Formatted stock HTML
		 */
		formatStock: function(status, quantity) {
			var statusLabels = {
				'instock': '<span class="aisales-stock aisales-stock--instock">In Stock</span>',
				'outofstock': '<span class="aisales-stock aisales-stock--outofstock">Out of Stock</span>',
				'onbackorder': '<span class="aisales-stock aisales-stock--backorder">On Backorder</span>'
			};

			var html = statusLabels[status] || '<span class="aisales-no-value">Unknown</span>';

			if (quantity !== null && quantity !== undefined && status === 'instock') {
				html += ' <span class="aisales-stock__qty">(' + quantity + ')</span>';
			}

			return html;
		},

		/**
		 * Format status display
		 * @param {string} status - Entity status
		 * @returns {string} Formatted status HTML
		 */
		formatStatus: function(status) {
			var statusClasses = {
				'publish': 'aisales-status--published',
				'draft': 'aisales-status--draft',
				'pending': 'aisales-status--pending',
				'private': 'aisales-status--private'
			};

			var statusLabels = {
				'publish': 'Published',
				'draft': 'Draft',
				'pending': 'Pending',
				'private': 'Private'
			};

			var cls = statusClasses[status] || '';
			var label = statusLabels[status] || status || 'Unknown';

			return '<span class="aisales-status ' + cls + '">' + label + '</span>';
		},

		/**
		 * Format message content (handle markdown-like formatting)
		 * @param {string} content - Message content
		 * @returns {string} Formatted HTML
		 */
		formatMessageContent: function(content) {
			if (!content) return '';

			// Escape HTML first
			var formatted = this.escapeHtml(content);

			// Convert basic markdown
			// Bold: **text**
			formatted = formatted.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');

			// Italic: *text*
			formatted = formatted.replace(/\*(.+?)\*/g, '<em>$1</em>');

			// Code: `code`
			formatted = formatted.replace(/`(.+?)`/g, '<code>$1</code>');

			// Line breaks
			formatted = formatted.replace(/\n/g, '<br>');

			// Parse inline quick options: {{quick_options:[...]}}
			var self = this;
			formatted = formatted.replace(
				/\{\{quick_options:(\[[\s\S]*?\])\}\}/g,
				function(match, optionsJson) {
					try {
						var unescaped = optionsJson
							.replace(/&quot;/g, '"')
							.replace(/&#039;/g, "'")
							.replace(/&lt;/g, '<')
							.replace(/&gt;/g, '>')
							.replace(/&amp;/g, '&')
							.replace(/<br>/g, '');
						var options = JSON.parse(unescaped);
						return self.renderInlineOptions(options);
					} catch (e) {
						console.error('Failed to parse quick_options:', e);
						return '';
					}
				}
			);

			// Parse standalone JSON blocks with quick_options
			formatted = formatted.replace(
				/(<br>)*\{(<br>)?\s*&quot;quick_options&quot;\s*:\s*\[[\s\S]*?\]\s*(<br>)?\}(\s*(<br>)*)?$/g,
				function(match) {
					try {
						var unescaped = match
							.replace(/&quot;/g, '"')
							.replace(/&#039;/g, "'")
							.replace(/&lt;/g, '<')
							.replace(/&gt;/g, '>')
							.replace(/&amp;/g, '&')
							.replace(/<br>/g, '\n')
							.trim();
						var parsed = JSON.parse(unescaped);
						if (parsed.quick_options && Array.isArray(parsed.quick_options)) {
							return self.renderInlineOptions(parsed.quick_options);
						}
						return match;
					} catch (e) {
						console.error('Failed to parse JSON quick_options block:', e);
						return match;
					}
				}
			);

			return formatted;
		},

		/**
		 * Render inline quick options as clickable buttons
		 * @param {Array} options - Options array
		 * @returns {string} HTML string
		 */
		renderInlineOptions: function(options) {
			if (!options || !Array.isArray(options) || options.length === 0) {
				return '';
			}

			var html = '<div class="aisales-inline-options">';
			var self = this;

			options.forEach(function(opt) {
				var label = self.escapeHtml(opt.label || '');
				var value = self.escapeHtml(opt.value || opt.label || '');
				var variant = opt.variant ? ' aisales-inline-option--' + self.escapeHtml(opt.variant) : '';
				var icon = opt.icon ? '<span class="dashicons dashicons-' + self.escapeHtml(opt.icon) + '"></span>' : '';

				html += '<button type="button" class="aisales-inline-option' + variant + '" data-option-value="' + value + '">';
				html += icon + label;
				html += '</button>';
			});

			html += '</div>';
			return html;
		},

		/**
		 * Animate balance counter from current value to new value
		 * @param {number} newBalance - Target balance
		 * @param {number} duration - Animation duration in ms
		 */
		animateBalance: function(newBalance, duration) {
			duration = duration || 800;
			var $el = app.elements.balanceDisplay;
			var startBalance = app.state.balance;
			var difference = newBalance - startBalance;
			var self = this;

			if (difference === 0) {
				return;
			}

			var startTime = null;
			var isDecreasing = difference < 0;

			$el.parent().addClass(isDecreasing ? 'aisales-balance--decreasing' : 'aisales-balance--increasing');

			function step(timestamp) {
				if (!startTime) startTime = timestamp;
				var elapsed = timestamp - startTime;
				var progress = Math.min(elapsed / duration, 1);

				// Ease out cubic
				var easeProgress = 1 - Math.pow(1 - progress, 3);

				var currentValue = Math.round(startBalance + (difference * easeProgress));
				$el.text(self.numberFormat(currentValue));

				if (progress < 1) {
					requestAnimationFrame(step);
				} else {
					$el.text(self.numberFormat(newBalance));
					app.state.balance = newBalance;

					setTimeout(function() {
						$el.parent().removeClass('aisales-balance--decreasing aisales-balance--increasing');
					}, 300);
				}
			}

			requestAnimationFrame(step);
		}
	};

	// Expose module
	app.formatting = formatting;

	// Also expose individual functions for backward compatibility
	window.AISalesChat.escapeHtml = formatting.escapeHtml.bind(formatting);
	window.AISalesChat.truncate = formatting.truncate.bind(formatting);
	window.AISalesChat.numberFormat = formatting.numberFormat.bind(formatting);
	window.AISalesChat.formatTime = formatting.formatTime.bind(formatting);
	window.AISalesChat.formatPrice = formatting.formatPrice.bind(formatting);
	window.AISalesChat.formatCurrency = formatting.formatCurrency.bind(formatting);
	window.AISalesChat.formatStock = formatting.formatStock.bind(formatting);
	window.AISalesChat.formatStatus = formatting.formatStatus.bind(formatting);
	window.AISalesChat.formatMessageContent = formatting.formatMessageContent.bind(formatting);

})(jQuery);
