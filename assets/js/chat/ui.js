/**
 * AI Sales Chat - UI Module
 * Handles message rendering, notifications, and UI state
 */
(function($) {
	'use strict';

	// Get app reference
	var app = window.AISalesChat = window.AISalesChat || {};

	/**
	 * UI module
	 */
	var ui = {
		/**
		 * Add a message to the chat
		 * @param {Object} message - Message object
		 * @param {boolean} isStreaming - Whether message is being streamed
		 */
		addMessage: function(message, isStreaming) {
			var $message = this.renderMessage(message, isStreaming);
			app.elements.messagesContainer.append($message);
			this.scrollToBottom();
		},

		/**
		 * Render a message
		 * @param {Object} message - Message object
		 * @param {boolean} isStreaming - Whether message is being streamed
		 * @returns {jQuery} Message element
		 */
		renderMessage: function(message, isStreaming) {
			var formatting = app.formatting;
			var templates = app.templates;

			var icons = {
				'user': 'dashicons-admin-users',
				'assistant': 'dashicons-admin-site-alt3',
				'system': 'dashicons-info'
			};

			var html = templates.message
				.replace('{role}', message.role)
				.replace('{id}', message.id)
				.replace('{icon}', icons[message.role] || 'dashicons-format-chat')
				.replace('{content}', formatting.formatMessageContent(message.content))
				.replace('{time}', formatting.formatTime(message.created_at))
				.replace('{tokens}', message.tokens_input ?
					'<span class="aisales-message__tokens">' + message.tokens_input + ' + ' + message.tokens_output + ' ' + aisalesChat.i18n.tokensUsed + '</span>' :
					''
				);

			var $message = $(html);

			// Add attachment indicators for user messages
			if (message.attachments && message.attachments.length > 0) {
				var attachmentHtml = '<div class="aisales-message__attachments">';
				message.attachments.forEach(function(att) {
					var isImage = att.mime_type && att.mime_type.startsWith('image/');
					var isPdf = att.mime_type === 'application/pdf';
					var icon = isImage ? 'dashicons-format-image' : (isPdf ? 'dashicons-pdf' : 'dashicons-media-default');
					attachmentHtml += '<span class="aisales-message__attachment"><span class="dashicons ' + icon + '"></span>' + formatting.escapeHtml(att.filename) + '</span>';
				});
				attachmentHtml += '</div>';
				$message.find('.aisales-message__content').prepend(attachmentHtml);
			}

			if (isStreaming) {
				$message.addClass('aisales-message--streaming');
				$message.attr('data-streaming', 'true');
			}

			return $message;
		},

		/**
		 * Update streaming message content
		 * @param {string} content - New content
		 */
		updateStreamingMessage: function(content) {
			var $streaming = app.elements.messagesContainer.find('[data-streaming="true"]');
			if ($streaming.length) {
				$streaming.find('.aisales-message__text').html(app.formatting.formatMessageContent(content));
				this.scrollToBottom();
			}
		},

		/**
		 * Finalize streaming message
		 */
		finalizeStreamingMessage: function() {
			var $streaming = app.elements.messagesContainer.find('[data-streaming="true"]');
			if ($streaming.length) {
				$streaming.removeClass('aisales-message--streaming');
				$streaming.removeAttr('data-streaming');
			}
		},

		/**
		 * Render all messages
		 */
		renderMessages: function() {
			var self = this;
			this.clearMessages();

			if (app.state.messages.length === 0) {
				return;
			}

			app.state.messages.forEach(function(message) {
				self.addMessage(message);
			});

			// Add pending suggestions to their messages
			Object.values(app.state.pendingSuggestions).forEach(function(suggestion) {
				app.renderSuggestionInMessage(suggestion);
				app.showPendingChange(suggestion);
			});
		},

		/**
		 * Clear messages container
		 */
		clearMessages: function() {
			app.elements.messagesContainer.empty();
		},

		/**
		 * Show welcome message
		 */
		showWelcomeMessage: function() {
			app.elements.chatWelcome.show();
		},

		/**
		 * Hide welcome message
		 */
		hideWelcomeMessage: function() {
			app.elements.chatWelcome.hide();
		},

		/**
		 * Show thinking indicator
		 */
		showThinking: function() {
			app.elements.messagesContainer.find('.aisales-message--thinking').remove();
			app.elements.messagesContainer.append(app.templates.thinking);
			this.scrollToBottom();
		},

		/**
		 * Hide thinking indicator
		 */
		hideThinking: function() {
			app.elements.messagesContainer.find('.aisales-message--thinking').remove();
		},

		/**
		 * Add error message
		 * @param {string} text - Error text
		 */
		addErrorMessage: function(text) {
			var escapeHtml = app.formatting.escapeHtml.bind(app.formatting);
			var $error = $('<div class="aisales-message aisales-message--error">' +
				'<div class="aisales-message__avatar"><span class="dashicons dashicons-warning"></span></div>' +
				'<div class="aisales-message__content">' +
				'<div class="aisales-message__text">' + escapeHtml(text) + '</div>' +
				'</div></div>');
			app.elements.messagesContainer.append($error);
			this.scrollToBottom();
		},

		/**
		 * Show a notice
		 * @param {string} message - Notice message
		 * @param {string} type - Notice type (success, error, warning, info)
		 */
		showNotice: function(message, type) {
			var escapeHtml = app.formatting.escapeHtml.bind(app.formatting);
			var $notice = $('<div class="notice notice-' + type + ' is-dismissible"><p>' + escapeHtml(message) + '</p></div>');
			$('.aisales-chat-page-header').after($notice);

			// Auto-dismiss after 5 seconds
			setTimeout(function() {
				$notice.fadeOut(300, function() {
					$(this).remove();
				});
			}, 5000);
		},

		/**
		 * Show tool processing message
		 * @param {string} message - Processing message
		 */
		showToolProcessingMessage: function(message) {
			var $processing = app.elements.messagesContainer.find('.aisales-message--tool-processing');

			if (!$processing.length) {
				$processing = $('<div class="aisales-message aisales-message--tool-processing">' +
					'<div class="aisales-message__avatar"><span class="dashicons dashicons-admin-tools"></span></div>' +
					'<div class="aisales-message__content">' +
					'<div class="aisales-message__text"></div>' +
					'</div></div>');
				app.elements.messagesContainer.append($processing);
			}

			$processing.find('.aisales-message__text').text(message);
			this.scrollToBottom();
		},

		/**
		 * Hide tool processing message
		 */
		hideToolProcessingMessage: function() {
			app.elements.messagesContainer.find('.aisales-message--tool-processing').remove();
		},

		/**
		 * Update tokens used display
		 * @param {Object} tokens - Tokens object
		 */
		updateTokensUsed: function(tokens) {
			app.elements.tokensUsed.text(tokens.total + ' ' + aisalesChat.i18n.tokensUsed);
		},

		/**
		 * Update balance display
		 * @param {number} change - Balance change
		 */
		updateBalance: function(change) {
			app.state.balance += change;
			if (app.state.balance < 0) app.state.balance = 0;
			app.elements.balanceDisplay.text(app.formatting.numberFormat(app.state.balance));
		},

		/**
		 * Enable inputs
		 */
		enableInputs: function() {
			app.elements.messageInput.prop('disabled', false);
			app.elements.sendButton.prop('disabled', false);
			app.elements.attachButton.prop('disabled', false);
		},

		/**
		 * Disable inputs
		 */
		disableInputs: function() {
			app.elements.messageInput.prop('disabled', true);
			app.elements.sendButton.prop('disabled', true);
			app.elements.attachButton.prop('disabled', true);
		},

		/**
		 * Set loading state
		 * @param {boolean} loading - Whether loading
		 */
		setLoading: function(loading) {
			app.state.isLoading = loading;

			if (loading) {
				app.elements.sendButton.addClass('aisales-btn--loading');
				app.elements.messageInput.prop('disabled', true);
			} else {
				app.elements.sendButton.removeClass('aisales-btn--loading');
				app.elements.messageInput.prop('disabled', false);
			}
		},

		/**
		 * Scroll chat to bottom
		 */
		scrollToBottom: function() {
			var container = app.elements.messagesContainer[0];
			if (container) {
				container.scrollTop = container.scrollHeight;
			}
		},

		/**
		 * Auto-resize textarea
		 */
		autoResizeTextarea: function() {
			var textarea = app.elements.messageInput[0];
			if (textarea) {
				textarea.style.height = 'auto';
				textarea.style.height = Math.min(textarea.scrollHeight, 200) + 'px';
			}
		},

		/**
		 * Handle error response
		 * @param {Object} xhr - XHR response
		 */
		handleError: function(xhr) {
			var message = aisalesChat.i18n.errorOccurred;

			if (xhr.responseJSON && xhr.responseJSON.error) {
				message = xhr.responseJSON.error.message || message;

				if (xhr.responseJSON.error.code === 'INSUFFICIENT_BALANCE') {
					message = aisalesChat.i18n.insufficientBalance;
				}
			}

			this.addErrorMessage(message);
		}
	};

	// Expose module
	app.ui = ui;

	// Expose individual functions for backward compatibility
	window.AISalesChat.addMessage = ui.addMessage.bind(ui);
	window.AISalesChat.renderMessage = ui.renderMessage.bind(ui);
	window.AISalesChat.updateStreamingMessage = ui.updateStreamingMessage.bind(ui);
	window.AISalesChat.renderMessages = ui.renderMessages.bind(ui);
	window.AISalesChat.clearMessages = ui.clearMessages.bind(ui);
	window.AISalesChat.showWelcomeMessage = ui.showWelcomeMessage.bind(ui);
	window.AISalesChat.showThinking = ui.showThinking.bind(ui);
	window.AISalesChat.hideThinking = ui.hideThinking.bind(ui);
	window.AISalesChat.addErrorMessage = ui.addErrorMessage.bind(ui);
	window.AISalesChat.showNotice = ui.showNotice.bind(ui);
	window.AISalesChat.enableInputs = ui.enableInputs.bind(ui);
	window.AISalesChat.disableInputs = ui.disableInputs.bind(ui);
	window.AISalesChat.setLoading = ui.setLoading.bind(ui);
	window.AISalesChat.scrollToBottom = ui.scrollToBottom.bind(ui);

})(jQuery);
