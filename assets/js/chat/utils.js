/**
 * AISales Chat - Utility Functions
 *
 * @package AISales_Sales_Manager
 */

(function($) {
	'use strict';

	const app = window.AISalesChat = window.AISalesChat || {};

	/**
	 * Utility functions namespace
	 */
	const utils = app.utils = {};

	/**
	 * Escape HTML special characters
	 * @param {string} str - String to escape
	 * @returns {string} Escaped string
	 */
	utils.escapeHtml = function(str) {
		if (!str) return '';
		return str
			.replace(/&/g, '&amp;')
			.replace(/</g, '&lt;')
			.replace(/>/g, '&gt;')
			.replace(/"/g, '&quot;')
			.replace(/'/g, '&#039;');
	};

	/**
	 * Truncate string to specified length
	 * @param {string} str - String to truncate
	 * @param {number} len - Maximum length
	 * @returns {string} Truncated string
	 */
	utils.truncate = function(str, len) {
		if (!str) return '';
		return str.length > len ? str.substring(0, len) + '...' : str;
	};

	/**
	 * Format number with commas
	 * @param {number} num - Number to format
	 * @returns {string} Formatted number
	 */
	utils.numberFormat = function(num) {
		return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
	};

	/**
	 * Format currency amount
	 * @param {number|string} amount - Amount to format
	 * @returns {string} Formatted currency
	 */
	utils.formatCurrency = function(amount) {
		if (!amount) return '';
		const num = parseFloat(amount);
		return isNaN(num) ? amount : '$' + num.toFixed(2);
	};

	/**
	 * Format price display with sale price support
	 * @param {number|string} regularPrice - Regular price
	 * @param {number|string} salePrice - Sale price (optional)
	 * @param {number|string} price - Current price
	 * @returns {string} HTML formatted price
	 */
	utils.formatPrice = function(regularPrice, salePrice, price) {
		if (!price && !regularPrice) return '<span class="aisales-no-value">Not set</span>';

		if (salePrice && regularPrice && salePrice !== regularPrice) {
			return '<del>' + utils.formatCurrency(regularPrice) + '</del> ' + utils.formatCurrency(salePrice);
		}

		return utils.formatCurrency(price || regularPrice);
	};

	/**
	 * Format stock status display
	 * @param {string} status - Stock status (instock, outofstock, onbackorder)
	 * @param {number} quantity - Stock quantity (optional)
	 * @returns {string} HTML formatted stock status
	 */
	utils.formatStock = function(status, quantity) {
		const statusLabels = {
			'instock': '<span class="aisales-stock aisales-stock--instock">In Stock</span>',
			'outofstock': '<span class="aisales-stock aisales-stock--outofstock">Out of Stock</span>',
			'onbackorder': '<span class="aisales-stock aisales-stock--backorder">On Backorder</span>'
		};

		let html = statusLabels[status] || '<span class="aisales-no-value">Unknown</span>';

		if (quantity !== null && quantity !== undefined && status === 'instock') {
			html += ' <span class="aisales-stock__qty">(' + quantity + ')</span>';
		}

		return html;
	};

	/**
	 * Format product/post status display
	 * @param {string} status - Post status (publish, draft, pending, private)
	 * @returns {string} HTML formatted status
	 */
	utils.formatStatus = function(status) {
		const statusClasses = {
			'publish': 'aisales-status--published',
			'draft': 'aisales-status--draft',
			'pending': 'aisales-status--pending',
			'private': 'aisales-status--private'
		};

		const statusLabels = {
			'publish': 'Published',
			'draft': 'Draft',
			'pending': 'Pending',
			'private': 'Private'
		};

		const cls = statusClasses[status] || '';
		const label = statusLabels[status] || status || 'Unknown';

		return '<span class="aisales-status ' + cls + '">' + label + '</span>';
	};

	/**
	 * Simple debounce function
	 * @param {Function} func - Function to debounce
	 * @param {number} wait - Wait time in milliseconds
	 * @returns {Function} Debounced function
	 */
	utils.debounce = function(func, wait) {
		var timeout;
		return function() {
			var context = this;
			var args = arguments;
			clearTimeout(timeout);
			timeout = setTimeout(function() {
				func.apply(context, args);
			}, wait);
		};
	};

	/**
	 * Highlight search match in text
	 * @param {string} text - Text to search in
	 * @param {string} query - Search query
	 * @returns {string} HTML with highlighted match
	 */
	utils.highlightSearchMatch = function(text, query) {
		if (!query) return utils.escapeHtml(text);

		const lowerText = text.toLowerCase();
		const lowerQuery = query.toLowerCase();
		const startIndex = lowerText.indexOf(lowerQuery);

		if (startIndex === -1) return utils.escapeHtml(text);

		const beforeMatch = text.substring(0, startIndex);
		const match = text.substring(startIndex, startIndex + query.length);
		const afterMatch = text.substring(startIndex + query.length);

		return utils.escapeHtml(beforeMatch) + '<mark>' + utils.escapeHtml(match) + '</mark>' + utils.escapeHtml(afterMatch);
	};

	/**
	 * Animate balance counter from current value to new value
	 * @param {number} newBalance - Target balance value
	 * @param {number} duration - Animation duration in ms (default: 800)
	 */
	utils.animateBalance = function(newBalance, duration) {
		duration = duration || 800;
		var $el = app.elements.balanceDisplay;
		var startBalance = app.state.balance;
		var difference = newBalance - startBalance;

		// If no change, just update
		if (difference === 0) {
			return;
		}

		var startTime = null;
		var isDecreasing = difference < 0;

		// Add visual feedback class
		$el.parent().addClass(isDecreasing ? 'aisales-balance--decreasing' : 'aisales-balance--increasing');

		function step(timestamp) {
			if (!startTime) startTime = timestamp;
			var elapsed = timestamp - startTime;
			var progress = Math.min(elapsed / duration, 1);

			// Ease out cubic for smooth deceleration
			var easeProgress = 1 - Math.pow(1 - progress, 3);

			var currentValue = Math.round(startBalance + (difference * easeProgress));
			$el.text(utils.numberFormat(currentValue));

			if (progress < 1) {
				requestAnimationFrame(step);
			} else {
				// Ensure final value is exact
				$el.text(utils.numberFormat(newBalance));
				app.state.balance = newBalance;

				// Remove feedback class after a short delay
				setTimeout(function() {
					$el.parent().removeClass('aisales-balance--decreasing aisales-balance--increasing');
				}, 300);
			}
		}

		requestAnimationFrame(step);
	};

	/**
	 * Sync balance to WordPress for persistence
	 * @param {number} newBalance - Balance value to sync
	 */
	utils.syncBalanceToWordPress = function(newBalance) {
		if (typeof aisalesChat === 'undefined') return;

		$.ajax({
			url: aisalesChat.ajaxUrl,
			method: 'POST',
			data: {
				action: 'aisales_sync_balance',
				nonce: aisalesChat.nonce,
				balance: newBalance
			}
		});
	};

	// Create backward-compatible global aliases for functions used throughout the codebase
	// These will be called from the main chat.js until full migration is complete
	window.AISalesChat._escapeHtml = utils.escapeHtml;
	window.AISalesChat._truncate = utils.truncate;
	window.AISalesChat._formatPrice = utils.formatPrice;
	window.AISalesChat._formatStock = utils.formatStock;
	window.AISalesChat._formatStatus = utils.formatStatus;
	window.AISalesChat._formatCurrency = utils.formatCurrency;
	window.AISalesChat._numberFormat = utils.numberFormat;
	window.AISalesChat._debounce = utils.debounce;
	window.AISalesChat._highlightSearchMatch = utils.highlightSearchMatch;
	window.AISalesChat._animateBalance = utils.animateBalance;
	window.AISalesChat._syncBalanceToWordPress = utils.syncBalanceToWordPress;

})(jQuery);
