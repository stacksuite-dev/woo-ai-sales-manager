/**
 * AISales Chat - Messaging Module
 * Handles chat sessions, message sending/receiving, SSE streaming, and rendering
 *
 * @package AISales_Sales_Manager
 */

(function($) {
	'use strict';

	const app = window.AISalesChat = window.AISalesChat || {};
	const utils = app.utils;

	/**
	 * Messaging namespace
	 */
	const messaging = app.messaging = {};

	// Get utility functions
	const escapeHtml = utils ? utils.escapeHtml : function(str) {
		if (!str) return '';
		return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
	};
	const animateBalance = utils ? utils.animateBalance : function(balance) {
		app.state.balance = balance;
		if (app.elements.balanceDisplay) {
			app.elements.balanceDisplay.text(balance.toLocaleString());
		}
	};
	const syncBalanceToWordPress = utils ? utils.syncBalanceToWordPress : function() {};

	// Templates (cached after init)
	let templates = {};

	/**
	 * Initialize messaging functionality
	 */
	messaging.init = function() {
		// Cache templates
		templates.message = $('#aisales-message-template').html() || '';
		templates.thinking = $('#aisales-thinking-template').html() || '';
	};

	/**
	 * Create a new chat session
	 * @param {Object} entity - The entity (product, category, or null for agent)
	 * @param {string} entityType - Type: 'product', 'category', or 'agent'
	 */
	messaging.createSession = function(entity, entityType) {
		const state = app.state;
		const elements = app.elements;

		if (state.isLoading) return;

		messaging.setLoading(true);
		messaging.clearMessages();

		const sessionData = {
			entity_type: entityType || state.entityType
		};

		// Handle different entity types
		if (entityType === 'agent') {
			sessionData.title = 'Marketing Agent';
			// Include store context for agent mode
			if (state.storeContext && Object.keys(state.storeContext).length > 0) {
				const filteredContext = {};
				for (const [key, value] of Object.entries(state.storeContext)) {
					if (value !== '' && value !== null && value !== undefined) {
						filteredContext[key] = value;
					}
				}
				if (Object.keys(filteredContext).length > 0) {
					sessionData.store_context = filteredContext;
				}
			}
		} else if (entityType === 'category') {
			sessionData.title = entity.name;
			sessionData.category_id = String(entity.id);
			sessionData.category_data = {
				id: String(entity.id),
				name: entity.name,
				slug: entity.slug,
				description: entity.description,
				parent_id: entity.parent_id,
				parent_name: entity.parent_name,
				product_count: entity.product_count,
				subcategory_count: entity.subcategory_count,
				subcategories: entity.subcategories,
				seo_title: entity.seo_title,
				meta_description: entity.meta_description
			};
			// Include store context if available
			if (state.storeContext && Object.keys(state.storeContext).length > 0) {
				const filteredContext = {};
				for (const [key, value] of Object.entries(state.storeContext)) {
					if (value !== '' && value !== null && value !== undefined) {
						filteredContext[key] = value;
					}
				}
				if (Object.keys(filteredContext).length > 0) {
					sessionData.store_context = filteredContext;
				}
			}
		} else {
			sessionData.title = entity.title;
			sessionData.product_id = String(entity.id);
			sessionData.product_data = {
				id: String(entity.id),
				title: entity.title,
				description: entity.description,
				short_description: entity.short_description,
				price: entity.price,
				sale_price: entity.sale_price,
				sku: entity.sku,
				stock_status: entity.stock_status,
				stock_quantity: entity.stock_quantity,
				categories: entity.categories,
				tags: entity.tags,
				image_url: entity.image_url,
				status: entity.status
			};
			// Include store context if available
			if (state.storeContext && Object.keys(state.storeContext).length > 0) {
				const filteredContext = {};
				for (const [key, value] of Object.entries(state.storeContext)) {
					if (value !== '' && value !== null && value !== undefined) {
						filteredContext[key] = value;
					}
				}
				if (Object.keys(filteredContext).length > 0) {
					sessionData.store_context = filteredContext;
				}
			}
		}

		$.ajax({
			url: aisalesChat.apiBaseUrl + '/ai/chat/sessions',
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				'X-API-Key': aisalesChat.apiKey
			},
			data: JSON.stringify(sessionData),
			success: function(response) {
				// Handle both direct API response and wrapped response
				const session = response.session || (response.data && response.data.session);
				if (session) {
					state.sessionId = session.id;
					messaging.loadSessionMessages(state.sessionId);
				} else {
					messaging.setLoading(false);
				}
			},
			error: function(xhr) {
				messaging.handleError(xhr);
				messaging.setLoading(false);
			}
		});
	};

	/**
	 * Load messages for a session
	 * @param {string} sessionId - Session ID
	 */
	messaging.loadSessionMessages = function(sessionId) {
		const state = app.state;

		$.ajax({
			url: aisalesChat.apiBaseUrl + '/ai/chat/sessions/' + sessionId,
			method: 'GET',
			headers: {
				'X-API-Key': aisalesChat.apiKey
			},
			success: function(response) {
				// Handle both direct API response and wrapped response
				const data = response.data || response;
				state.messages = data.messages || [];
				state.pendingSuggestions = {};

				// Track pending suggestions
				(data.pending_suggestions || []).forEach(function(suggestion) {
					state.pendingSuggestions[suggestion.id] = suggestion;
				});

				messaging.renderMessages();
				if (typeof app.updatePendingSummary === 'function') {
					app.updatePendingSummary();
				}
				messaging.setLoading(false);
			},
			error: function(xhr) {
				messaging.handleError(xhr);
				messaging.setLoading(false);
			}
		});
	};

	/**
	 * Send a message to the chat
	 * @param {string} content - Message content
	 * @param {string} quickAction - Optional quick action identifier
	 */
	messaging.sendMessage = function(content, quickAction) {
		const state = app.state;
		const elements = app.elements;

		if (state.isLoading) return;

		messaging.setLoading(true);
		elements.messageInput.val('');

		// Capture attachments before clearing - use module if available
		var attachmentsData;
		if (app.attachments && typeof app.attachments.getForSending === 'function') {
			attachmentsData = app.attachments.getForSending();
		} else {
			attachmentsData = state.pendingAttachments.map(function(a) {
				return {
					filename: a.filename,
					mime_type: a.mime_type,
					data: a.data
				};
			});
		}

		// Add user message to UI immediately (with attachment indicators)
		const messageData = {
			id: 'temp-' + Date.now(),
			role: 'user',
			content: content,
			created_at: new Date().toISOString(),
			attachments: attachmentsData.length > 0 ? attachmentsData : undefined
		};
		messaging.addMessage(messageData);

		// Clear attachments after capturing - use module if available
		if (app.attachments && typeof app.attachments.clear === 'function') {
			app.attachments.clear();
		}

		// Show thinking indicator
		messaging.showThinking();

		// Build request data
		const requestData = {
			content: content
		};

		if (quickAction) {
			requestData.quick_action = quickAction;
		}

		if (attachmentsData.length > 0) {
			requestData.attachments = attachmentsData;
		}

		// Try SSE first, fall back to regular request
		messaging.sendMessageSSE(requestData);
	};

	/**
	 * Send message with SSE streaming
	 * @param {Object} requestData - Request payload
	 */
	messaging.sendMessageSSE = function(requestData) {
		const state = app.state;
		const url = aisalesChat.apiBaseUrl + '/ai/chat/sessions/' + state.sessionId + '/messages';

		// Use fetch with streaming
		fetch(url, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				'X-API-Key': aisalesChat.apiKey,
				'Accept': 'text/event-stream'
			},
			body: JSON.stringify(requestData)
		})
		.then(function(response) {
			if (!response.ok) {
				// Handle HTTP errors by parsing the JSON response
				return response.json().then(function(errorData) {
					throw { status: response.status, data: errorData };
				}).catch(function(parseError) {
					// If JSON parsing fails, throw generic error with status
					if (parseError.status) throw parseError;
					throw { status: response.status, data: null };
				});
			}

			const contentType = response.headers.get('content-type');

			// Check if SSE response
			if (contentType && contentType.includes('text/event-stream')) {
				return messaging.handleSSEResponse(response);
			} else {
				// Regular JSON response
				return response.json().then(function(data) {
					messaging.hideThinking();
					// Handle both wrapped {success, data} and direct response formats
					const responseData = data.data || data;
					if (responseData.assistant_message || responseData.suggestions) {
						messaging.handleMessageResponse(responseData);
					}
					messaging.setLoading(false);
				});
			}
		})
		.catch(function(error) {
			console.error('Chat error:', error);
			messaging.hideThinking();
			
			// Handle specific error codes
			let errorMessage = aisalesChat.i18n.connectionError;
			
			if (error.status === 402) {
				// Payment required - insufficient balance
				errorMessage = aisalesChat.i18n.insufficientBalance || 'Insufficient token balance. Please top up to continue.';
			} else if (error.data && error.data.error) {
				// Use error message from API if available
				if (error.data.error.code === 'insufficient_balance') {
					errorMessage = aisalesChat.i18n.insufficientBalance || 'Insufficient token balance. Please top up to continue.';
				} else if (error.data.error.message) {
					errorMessage = error.data.error.message;
				}
			}
			
			messaging.addErrorMessage(errorMessage);
			messaging.setLoading(false);
		});
	};

	/**
	 * Handle SSE streaming response
	 * @param {Response} response - Fetch response object
	 */
	messaging.handleSSEResponse = function(response) {
		const state = app.state;
		const elements = app.elements;
		const reader = response.body.getReader();
		const decoder = new TextDecoder();
		let buffer = '';
		let assistantMessage = null;
		let messageContent = '';
		let pendingEventType = null; // Persist event type across chunks

		function processChunk(chunk) {
			buffer += decoder.decode(chunk, { stream: true });

			// Process complete events
			const lines = buffer.split('\n');
			buffer = lines.pop() || ''; // Keep incomplete line

			lines.forEach(function(line) {
				if (line.startsWith('event:')) {
					pendingEventType = line.substring(6).trim();
				} else if (line.startsWith('data:')) {
					const dataStr = line.substring(5).trim();
					try {
						const eventData = JSON.parse(dataStr);
						handleSSEEvent(pendingEventType, eventData);
					} catch (e) {
						// Not valid JSON, ignore
					}
					pendingEventType = null; // Reset after handling
				}
			});
		}

		function handleSSEEvent(event, data) {
			switch (event) {
				case 'message_start':
					assistantMessage = {
						id: data.id,
						role: 'assistant',
						content: '',
						created_at: new Date().toISOString()
					};
					break;

				case 'content_delta':
					if (data.delta) {
						// On first content, hide thinking/processing indicators and add the message bubble
						if (!messageContent) {
							messaging.hideThinking();
							messaging.hideToolProcessingMessage();
							// Create assistant message if not already created by message_start
							if (!assistantMessage) {
								assistantMessage = {
									id: 'msg-' + Date.now(),
									role: 'assistant',
									content: '',
									created_at: new Date().toISOString()
								};
							}
							messaging.addMessage(assistantMessage, true);
						}
						messageContent += data.delta;
						messaging.updateStreamingMessage(messageContent);
					}
					break;

				case 'suggestion':
					if (data.suggestion) {
						if (typeof app.handleSuggestionReceived === 'function') {
							app.handleSuggestionReceived(data.suggestion);
						}
					}
					break;

				case 'usage':
					if (data.tokens) {
						messaging.updateTokensUsed(data.tokens);
						// Don't update balance here - wait for balance_update event with accurate value
					}
					break;

				case 'balance_update':
					if (typeof data.new_balance !== 'undefined') {
						// Animate the balance change
						animateBalance(data.new_balance);
						// Sync to WordPress for page refresh persistence
						syncBalanceToWordPress(data.new_balance);
					}
					break;

				case 'message_end':
					if (assistantMessage) {
						assistantMessage.content = messageContent;
						state.messages.push(assistantMessage);
					}
					messageContent = '';
					break;

				case 'data_request':
					// AI is requesting data from WordPress
					if (data.requests && data.requests.length > 0) {
						// Show interim message if provided
						if (data.interim_message) {
							messaging.showToolProcessingMessage(data.interim_message);
						}
						// Fetch tool data and continue conversation
						messaging.handleToolDataRequests(data.requests);
					}
					break;

				case 'tool_processing':
					// Status update about tool processing
					if (data.message) {
						messaging.showToolProcessingMessage(data.message);
					}
					break;

				case 'image_generating':
					// AI is generating an image
					if (typeof app.showImageGeneratingIndicator === 'function') {
						app.showImageGeneratingIndicator(data.prompt || 'Creating your image...');
					}
					break;

				case 'image_generated':
					// Image generation complete
					if (typeof app.hideImageGeneratingIndicator === 'function') {
						app.hideImageGeneratingIndicator();
					}
					if (data.url && typeof app.appendGeneratedImage === 'function') {
						app.appendGeneratedImage(data);
					}
					break;

				case 'catalog_suggestion':
					// Catalog reorganization suggestion from AI
					if (data.suggestion && typeof app.renderCatalogSuggestion === 'function') {
						app.renderCatalogSuggestion(data.suggestion);
					}
					break;

				case 'research_confirmation':
					// Market research requires user confirmation
					if (data && typeof app.showResearchConfirmation === 'function') {
						app.showResearchConfirmation(data);
					}
					break;

				case 'done':
					messaging.setLoading(false);
					break;

				case 'error':
					messaging.hideThinking();
					messaging.addErrorMessage(data.message || aisalesChat.i18n.errorOccurred);
					messaging.setLoading(false);
					break;
			}
		}

		function read() {
			return reader.read().then(function(result) {
				if (result.done) {
					messaging.setLoading(false);
					return;
				}
				processChunk(result.value);
				return read();
			});
		}

		return read();
	};

	/**
	 * Handle message response (non-SSE)
	 * @param {Object} data - Response data
	 */
	messaging.handleMessageResponse = function(data) {
		if (data.assistant_message) {
			messaging.addMessage(data.assistant_message);
		}

		if (data.suggestions && data.suggestions.length > 0) {
			data.suggestions.forEach(function(suggestion) {
				if (typeof app.handleSuggestionReceived === 'function') {
					app.handleSuggestionReceived(suggestion);
				}
			});
		}

		if (data.tokens_used) {
			messaging.updateTokensUsed(data.tokens_used);
			messaging.updateBalance(-data.tokens_used.total);
		}
	};

	/**
	 * Handle tool data requests from AI
	 * Fetches data via WordPress AJAX and sends results back to API
	 * @param {Array} requests - Tool data requests
	 */
	messaging.handleToolDataRequests = function(requests) {
		if (!requests || requests.length === 0) {
			return;
		}

		$.ajax({
			url: aisalesChat.ajaxUrl,
			method: 'POST',
			data: {
				action: 'aisales_fetch_tool_data',
				nonce: aisalesChat.nonce,
				requests: JSON.stringify(requests)
			},
			success: function(response) {
				messaging.hideToolProcessingMessage();
				if (response.success && response.data && response.data.tool_results) {
					messaging.sendToolResults(response.data.tool_results);
				} else {
					messaging.sendToolResults(messaging.createToolErrorResults(requests, response.data || 'Failed to fetch tool data'));
				}
			},
			error: function(xhr) {
				messaging.hideToolProcessingMessage();
				console.error('Tool data fetch error:', xhr);
				messaging.sendToolResults(messaging.createToolErrorResults(requests, 'Network error fetching tool data'));
			}
		});
	};

	/**
	 * Create error results for failed tool requests
	 * @param {Array} requests - Original requests
	 * @param {string} errorMessage - Error message
	 * @returns {Array} Error results
	 */
	messaging.createToolErrorResults = function(requests, errorMessage) {
		return requests.map(function(req) {
			return {
				tool_call_id: req.tool_call_id,
				error: errorMessage
			};
		});
	};

	/**
	 * Send tool results back to API to continue the conversation
	 * @param {Array} toolResults - Tool execution results
	 */
	messaging.sendToolResults = function(toolResults) {
		const state = app.state;

		if (!state.sessionId || !toolResults || toolResults.length === 0) {
			return;
		}

		// Show thinking indicator while AI processes the results
		messaging.showThinking();

		const requestData = {
			role: 'tool',
			content: 'Tool execution results',
			tool_results: toolResults
		};

		// Send tool results using SSE for streaming response
		const url = aisalesChat.apiBaseUrl + '/ai/chat/sessions/' + state.sessionId + '/messages';

		fetch(url, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				'X-API-Key': aisalesChat.apiKey,
				'Accept': 'text/event-stream'
			},
			body: JSON.stringify(requestData)
		})
		.then(function(response) {
			if (!response.ok) {
				// Handle HTTP errors by parsing the JSON response
				return response.json().then(function(errorData) {
					throw { status: response.status, data: errorData };
				}).catch(function(parseError) {
					if (parseError.status) throw parseError;
					throw { status: response.status, data: null };
				});
			}

			const contentType = response.headers.get('content-type');

			if (contentType && contentType.includes('text/event-stream')) {
				return messaging.handleSSEResponse(response);
			} else {
				return response.json().then(function(data) {
					messaging.hideThinking();
					const responseData = data.data || data;
					if (responseData.assistant_message || responseData.suggestions) {
						messaging.handleMessageResponse(responseData);
					}
					messaging.setLoading(false);
				});
			}
		})
		.catch(function(error) {
			console.error('Tool results send error:', error);
			messaging.hideThinking();

			// Handle specific error codes
			let errorMessage = aisalesChat.i18n.connectionError || 'Connection error';

			if (error.status === 402) {
				errorMessage = aisalesChat.i18n.insufficientBalance || 'Insufficient token balance. Please top up to continue.';
			} else if (error.data && error.data.error) {
				if (error.data.error.code === 'insufficient_balance') {
					errorMessage = aisalesChat.i18n.insufficientBalance || 'Insufficient token balance. Please top up to continue.';
				} else if (error.data.error.message) {
					errorMessage = error.data.error.message;
				}
			}
			
			messaging.addErrorMessage(errorMessage);
			messaging.setLoading(false);
		});
	};

	/**
	 * Add a message to the chat
	 * @param {Object} message - Message object
	 * @param {boolean} isStreaming - Whether this is a streaming message
	 */
	messaging.addMessage = function(message, isStreaming) {
		const $message = messaging.renderMessage(message, isStreaming);
		app.elements.messagesContainer.append($message);
		messaging.scrollToBottom();
	};

	/**
	 * Render a message
	 * @param {Object} message - Message object
	 * @param {boolean} isStreaming - Whether this is a streaming message
	 * @returns {jQuery} Message element
	 */
	messaging.renderMessage = function(message, isStreaming) {
		const icons = {
			'user': 'dashicons-admin-users',
			'assistant': 'dashicons-admin-site-alt3',
			'system': 'dashicons-info'
		};

		let html = templates.message
			.replace('{role}', message.role)
			.replace('{id}', message.id)
			.replace('{icon}', icons[message.role] || 'dashicons-format-chat')
			.replace('{content}', messaging.formatMessageContent(message.content))
			.replace('{time}', messaging.formatTime(message.created_at))
			.replace('{tokens}', message.tokens_input ?
				'<span class="aisales-message__tokens">' + message.tokens_input + ' + ' + message.tokens_output + ' ' + aisalesChat.i18n.tokensUsed + '</span>' :
				''
			);

		const $message = $(html);

		// Add attachment indicators for user messages
		if (message.attachments && message.attachments.length > 0) {
			let attachmentHtml = '<div class="aisales-message__attachments">';
			message.attachments.forEach(function(att) {
				const isImage = att.mime_type && att.mime_type.startsWith('image/');
				const isPdf = att.mime_type === 'application/pdf';
				const icon = isImage ? 'dashicons-format-image' : (isPdf ? 'dashicons-pdf' : 'dashicons-media-default');
				attachmentHtml += '<span class="aisales-message__attachment"><span class="dashicons ' + icon + '"></span>' + escapeHtml(att.filename) + '</span>';
			});
			attachmentHtml += '</div>';
			$message.find('.aisales-message__content').prepend(attachmentHtml);
		}

		if (isStreaming) {
			$message.addClass('aisales-message--streaming');
			$message.attr('data-streaming', 'true');
		}

		return $message;
	};

	/**
	 * Update streaming message content
	 * @param {string} content - Updated content
	 */
	messaging.updateStreamingMessage = function(content) {
		const $streaming = app.elements.messagesContainer.find('[data-streaming="true"]');
		if ($streaming.length) {
			$streaming.find('.aisales-message__text').html(messaging.formatMessageContent(content));
			messaging.scrollToBottom();
		}
	};

	/**
	 * Render all messages
	 */
	messaging.renderMessages = function() {
		const state = app.state;

		messaging.clearMessages();

		if (state.messages.length === 0) {
			return;
		}

		state.messages.forEach(function(message) {
			messaging.addMessage(message);
		});

		// Add pending suggestions to their messages
		Object.values(state.pendingSuggestions).forEach(function(suggestion) {
			if (typeof app.renderSuggestionInMessage === 'function') {
				app.renderSuggestionInMessage(suggestion);
			}
			if (typeof app.showPendingChange === 'function') {
				app.showPendingChange(suggestion);
			}
		});
	};

	/**
	 * Clear messages container
	 */
	messaging.clearMessages = function() {
		app.elements.messagesContainer.empty();
	};

	/**
	 * Show thinking indicator
	 */
	messaging.showThinking = function() {
		app.elements.messagesContainer.find('.aisales-message--thinking').remove();
		app.elements.messagesContainer.append(templates.thinking);
		messaging.scrollToBottom();
	};

	/**
	 * Hide thinking indicator
	 */
	messaging.hideThinking = function() {
		app.elements.messagesContainer.find('.aisales-message--thinking').remove();
	};

	/**
	 * Show tool processing status message
	 * @param {string} message - Status message
	 */
	messaging.showToolProcessingMessage = function(message) {
		const elements = app.elements;

		// Remove any existing tool processing message
		elements.messagesContainer.find('.aisales-message--tool-processing').remove();

		const $toolMessage = $(
			'<div class="aisales-message aisales-message--tool-processing">' +
				'<div class="aisales-message__avatar"><span class="dashicons dashicons-database"></span></div>' +
				'<div class="aisales-message__content">' +
					'<div class="aisales-message__text">' +
						'<span class="aisales-tool-spinner"></span> ' +
						escapeHtml(message) +
					'</div>' +
				'</div>' +
			'</div>'
		);

		elements.messagesContainer.append($toolMessage);
		messaging.scrollToBottom();
	};

	/**
	 * Hide tool processing message
	 */
	messaging.hideToolProcessingMessage = function() {
		app.elements.messagesContainer.find('.aisales-message--tool-processing').remove();
	};

	/**
	 * Add an error message to the chat
	 * @param {string} text - Error message text
	 */
	messaging.addErrorMessage = function(text) {
		const $error = $(
			'<div class="aisales-message aisales-message--error">' +
				'<div class="aisales-message__avatar"><span class="dashicons dashicons-warning"></span></div>' +
				'<div class="aisales-message__content">' +
					'<div class="aisales-message__text">' + escapeHtml(text) + '</div>' +
				'</div>' +
			'</div>'
		);
		app.elements.messagesContainer.append($error);
		messaging.scrollToBottom();

		// Auto-remove after 5 seconds
		setTimeout(function() {
			$error.fadeOut(300, function() {
				$(this).remove();
			});
		}, 5000);
	};

	/**
	 * Set loading state
	 * @param {boolean} loading - Loading state
	 */
	messaging.setLoading = function(loading) {
		const state = app.state;
		const elements = app.elements;

		state.isLoading = loading;
		const hasEntity = state.isAgentMode || (state.entityType === 'category' ? state.selectedCategory : state.selectedProduct);
		elements.sendButton.prop('disabled', loading || !hasEntity);
		elements.messageInput.prop('disabled', loading || !hasEntity);

		if (loading) {
			elements.sendButton.addClass('aisales-btn--loading');
		} else {
			elements.sendButton.removeClass('aisales-btn--loading');
		}
	};

	/**
	 * Scroll chat to bottom
	 */
	messaging.scrollToBottom = function() {
		app.elements.messagesContainer.scrollTop(app.elements.messagesContainer[0].scrollHeight);
	};

	/**
	 * Handle error response
	 * @param {Object} xhr - jQuery XHR object
	 */
	messaging.handleError = function(xhr) {
		let message = aisalesChat.i18n.errorOccurred;

		if (xhr.responseJSON && xhr.responseJSON.error) {
			message = xhr.responseJSON.error.message || message;

			if (xhr.responseJSON.error.code === 'INSUFFICIENT_BALANCE') {
				message = aisalesChat.i18n.insufficientBalance;
			}
		}

		messaging.addErrorMessage(message);
	};

	/**
	 * Update tokens used display
	 * @param {Object} tokens - Token usage data
	 */
	messaging.updateTokensUsed = function(tokens) {
		const elements = app.elements;

		if (elements.tokensUsed && tokens) {
			const total = (tokens.input || 0) + (tokens.output || 0);
			elements.tokensUsed.text(total.toLocaleString() + ' tokens');
		}
	};

	/**
	 * Update balance display
	 * @param {number} delta - Amount to change (negative for decrease)
	 */
	messaging.updateBalance = function(delta) {
		const state = app.state;
		state.balance = Math.max(0, state.balance + delta);
		if (app.elements.balanceDisplay) {
			app.elements.balanceDisplay.text(state.balance.toLocaleString());
		}
	};

	/**
	 * Format message content (handle markdown-like formatting)
	 * @param {string} content - Raw message content
	 * @returns {string} Formatted HTML
	 */
	messaging.formatMessageContent = function(content) {
		if (!content) return '';

		// Escape HTML first
		let formatted = escapeHtml(content);

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
		// The JSON is escaped, so we need to unescape common entities
		formatted = formatted.replace(
			/\{\{quick_options:(\[[\s\S]*?\])\}\}/g,
			function(match, optionsJson) {
				try {
					// Unescape HTML entities in the JSON string
					var unescaped = optionsJson
						.replace(/&quot;/g, '"')
						.replace(/&#039;/g, "'")
						.replace(/&lt;/g, '<')
						.replace(/&gt;/g, '>')
						.replace(/&amp;/g, '&')
						.replace(/<br>/g, '');
					var options = JSON.parse(unescaped);
					return messaging.renderInlineOptions(options);
				} catch (e) {
					console.error('Failed to parse quick_options:', e);
					return '';
				}
			}
		);

		// Parse standalone JSON blocks with quick_options (AI sometimes outputs raw JSON)
		// Match: { "quick_options": [...] } at end of message
		formatted = formatted.replace(
			/(<br>)*\{(<br>)?\s*&quot;quick_options&quot;\s*:\s*\[[\s\S]*?\]\s*(<br>)?\}(\s*(<br>)*)?$/g,
			function(match) {
				try {
					// Unescape HTML entities
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
						return messaging.renderInlineOptions(parsed.quick_options);
					}
					return match;
				} catch (e) {
					console.error('Failed to parse JSON quick_options block:', e);
					return match;
				}
			}
		);

		return formatted;
	};

	/**
	 * Render inline quick options as clickable buttons
	 * @param {Array} options - Options array
	 * @returns {string} HTML string
	 */
	messaging.renderInlineOptions = function(options) {
		if (!options || !Array.isArray(options) || options.length === 0) {
			return '';
		}

		var html = '<div class="aisales-inline-options">';
		
		options.forEach(function(opt) {
			var label = escapeHtml(opt.label || '');
			var value = escapeHtml(opt.value || opt.label || '');
			var variant = opt.variant ? ' aisales-inline-option--' + escapeHtml(opt.variant) : '';
			var icon = opt.icon ? '<span class="dashicons dashicons-' + escapeHtml(opt.icon) + '"></span>' : '';
			
			html += '<button type="button" class="aisales-inline-option' + variant + '" data-option-value="' + value + '">';
			html += icon + label;
			html += '</button>';
		});
		
		html += '</div>';
		return html;
	};

	/**
	 * Format time for display
	 * @param {string} isoString - ISO date string
	 * @returns {string} Formatted time
	 */
	messaging.formatTime = function(isoString) {
		if (!isoString) return '';
		const date = new Date(isoString);
		return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
	};

	// Expose for backward compatibility
	window.AISalesChat.createSession = messaging.createSession;
	window.AISalesChat.sendMessage = messaging.sendMessage;
	window.AISalesChat.clearMessages = messaging.clearMessages;
	window.AISalesChat.addMessage = messaging.addMessage;
	window.AISalesChat.showThinking = messaging.showThinking;
	window.AISalesChat.hideThinking = messaging.hideThinking;
	window.AISalesChat.setLoading = messaging.setLoading;
	window.AISalesChat.scrollToBottom = messaging.scrollToBottom;

})(jQuery);
