/**
 * AISales Chat - Context Panel Module
 * Handles store context panel, onboarding, and notices
 *
 * @package AISales_Sales_Manager
 */

(function($) {
	'use strict';

	const app = window.AISalesChat = window.AISalesChat || {};
	const utils = app.utils;

	/**
	 * Context panel namespace
	 */
	const context = app.context = {};

	/**
	 * Initialize context panel functionality
	 */
	context.init = function() {
		context.bindEvents();
	};

	/**
	 * Bind context panel event handlers
	 */
	context.bindEvents = function() {
		const elements = app.elements;

		// Store context panel
		elements.storeContextBtn.on('click', context.open);
		$('#aisales-close-context, #aisales-cancel-context').on('click', context.close);
		elements.contextBackdrop.on('click', context.close);
		$('#aisales-save-context').on('click', context.save);
		$('#aisales-sync-context').on('click', context.sync);

		// Onboarding
		$('#aisales-onboarding-setup').on('click', function() {
			context.closeOnboarding();
			context.open();
		});
		$('#aisales-onboarding-skip').on('click', context.closeOnboarding);

		// Welcome context hint
		$('#aisales-welcome-setup-context').on('click', context.open);
	};

	/**
	 * Open store context panel
	 */
	context.open = function() {
		app.elements.contextPanel.addClass('aisales-context-panel--open');
		$('body').addClass('aisales-context-panel-active');
	};

	/**
	 * Close store context panel
	 */
	context.close = function() {
		app.elements.contextPanel.removeClass('aisales-context-panel--open');
		$('body').removeClass('aisales-context-panel-active');
	};

	/**
	 * Save store context
	 */
	context.save = function() {
		const formData = {
			store_name: $('#aisales-store-name').val(),
			store_description: $('#aisales-store-description').val(),
			business_niche: $('#aisales-business-niche').val(),
			target_audience: $('#aisales-target-audience').val(),
			brand_tone: $('input[name="brand_tone"]:checked').val() || '',
			language: $('#aisales-language').val(),
			custom_instructions: $('#aisales-custom-instructions').val()
		};

		const $saveBtn = $('#aisales-save-context');
		$saveBtn.addClass('aisales-btn--loading').prop('disabled', true);

		$.ajax({
			url: aisalesChat.ajaxUrl,
			method: 'POST',
			data: {
				action: 'aisales_save_store_context',
				nonce: aisalesChat.nonce,
				context: formData
			},
			success: function(response) {
				if (response.success) {
					app.state.storeContext = formData;
					context.updateStatus(formData);
					context.close();

					// Show success notice
					context.showNotice('Store context saved successfully', 'success');
				} else {
					context.showNotice(response.data || 'Failed to save store context', 'error');
				}
			},
			error: function() {
				context.showNotice('Failed to save store context', 'error');
			},
			complete: function() {
				$saveBtn.removeClass('aisales-btn--loading').prop('disabled', false);
			}
		});
	};

	/**
	 * Sync store context (re-fetch category/product counts)
	 */
	context.sync = function() {
		const $syncBtn = $('#aisales-sync-context');
		$syncBtn.addClass('aisales-btn--loading').prop('disabled', true);

		$.ajax({
			url: aisalesChat.ajaxUrl,
			method: 'POST',
			data: {
				action: 'aisales_sync_store_context',
				nonce: aisalesChat.nonce
			},
			success: function(response) {
				if (response.success) {
					$('#aisales-sync-status').text(response.data.message || 'Synced successfully');
				} else {
					context.showNotice(response.data || 'Sync failed', 'error');
				}
			},
			error: function() {
				context.showNotice('Sync failed', 'error');
			},
			complete: function() {
				$syncBtn.removeClass('aisales-btn--loading').prop('disabled', false);
			}
		});
	};

	/**
	 * Update context status indicator
	 * @param {Object} contextData - Store context data
	 */
	context.updateStatus = function(contextData) {
		const hasRequired = contextData.store_name || contextData.business_niche;
		const hasOptional = contextData.target_audience || contextData.brand_tone;

		let status = 'missing';
		if (hasRequired) {
			status = hasOptional ? 'configured' : 'partial';
		}

		$('.aisales-context-status')
			.removeClass('aisales-context-status--configured aisales-context-status--partial aisales-context-status--missing')
			.addClass('aisales-context-status--' + status);

		// Update store name in button
		if (contextData.store_name) {
			$('.aisales-store-name').text(contextData.store_name);
		}
	};

	/**
	 * Close onboarding overlay
	 */
	context.closeOnboarding = function() {
		app.elements.onboardingOverlay.fadeOut(300, function() {
			$(this).remove();
		});

		// Mark as visited
		$.ajax({
			url: aisalesChat.ajaxUrl,
			method: 'POST',
			data: {
				action: 'aisales_mark_chat_visited',
				nonce: aisalesChat.nonce
			}
		});
	};

	/**
	 * Show a notice
	 * @param {string} message - Notice message
	 * @param {string} type - Notice type: 'success', 'error', 'warning', 'info'
	 */
	context.showNotice = function(message, type) {
		const escapeHtml = utils ? utils.escapeHtml : function(str) {
			if (!str) return '';
			return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
		};

		const $notice = $('<div class="notice notice-' + type + ' is-dismissible"><p>' + escapeHtml(message) + '</p></div>');
		$('.aisales-chat-page-header').after($notice);

		// Auto-dismiss after 5 seconds
		setTimeout(function() {
			$notice.fadeOut(300, function() {
				$(this).remove();
			});
		}, 5000);
	};

	// Expose for backward compatibility
	window.AISalesChat.openContextPanel = context.open;
	window.AISalesChat.closeContextPanel = context.close;
	window.AISalesChat.showNotice = context.showNotice;

})(jQuery);
