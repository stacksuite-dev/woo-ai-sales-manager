/**
 * AISales Chat - Attachments Module
 * Handles file attachments, drag & drop, paste, and image resizing
 *
 * @package AISales_Sales_Manager
 */

(function($) {
	'use strict';

	const app = window.AISalesChat = window.AISalesChat || {};
	const utils = app.utils;

	/**
	 * Attachments namespace
	 */
	const attachments = app.attachments = {};

	/**
	 * Initialize attachments functionality
	 */
	attachments.init = function() {
		attachments.bindEvents();
	};

	/**
	 * Bind attachment event handlers
	 */
	attachments.bindEvents = function() {
		const elements = app.elements;

		// Attachment button click
		elements.attachButton.on('click', function() {
			elements.fileInput.click();
		});

		// File input change
		elements.fileInput.on('change', attachments.handleFileSelect);

		// Remove attachment
		elements.attachmentPreviews.on('click', '.aisales-attachment-remove', attachments.handleRemove);

		// Drag and drop
		attachments.setupDragAndDrop();

		// Paste handling for images
		elements.messageInput.on('paste', attachments.handlePaste);
	};

	/**
	 * Handle file selection from input
	 * @param {Event} e - Change event
	 */
	attachments.handleFileSelect = function(e) {
		const files = Array.from(e.target.files || []);
		attachments.processFiles(files);
		// Reset input so same file can be selected again
		e.target.value = '';
	};

	/**
	 * Handle removing an attachment
	 * @param {Event} e - Click event
	 */
	attachments.handleRemove = function(e) {
		const index = $(e.currentTarget).closest('.aisales-attachment-preview').data('index');
		app.state.pendingAttachments.splice(index, 1);
		attachments.updatePreviews();
	};

	/**
	 * Handle paste event for images
	 * @param {Event} e - Paste event
	 */
	attachments.handlePaste = function(e) {
		const clipboardData = e.originalEvent.clipboardData;
		if (!clipboardData || !clipboardData.items) return;

		const items = Array.from(clipboardData.items);
		const imageItems = items.filter(item => item.type.startsWith('image/'));

		if (imageItems.length > 0) {
			e.preventDefault();
			const files = imageItems.map(item => item.getAsFile()).filter(Boolean);
			attachments.processFiles(files);
		}
	};

	/**
	 * Setup drag and drop for attachments
	 */
	attachments.setupDragAndDrop = function() {
		const $dropZone = $('.aisales-chat-input');

		$dropZone.on('dragenter dragover', function(e) {
			e.preventDefault();
			e.stopPropagation();
			$(this).addClass('aisales-drag-over');
		});

		$dropZone.on('dragleave drop', function(e) {
			e.preventDefault();
			e.stopPropagation();
			$(this).removeClass('aisales-drag-over');
		});

		$dropZone.on('drop', function(e) {
			const files = Array.from(e.originalEvent.dataTransfer.files || []);
			attachments.processFiles(files);
		});
	};

	/**
	 * Process selected/dropped/pasted files
	 * @param {File[]} files - Array of files to process
	 */
	attachments.processFiles = function(files) {
		const state = app.state;

		if (!files || files.length === 0) return;

		// Check max attachments
		const remainingSlots = state.maxAttachments - state.pendingAttachments.length;
		if (remainingSlots <= 0) {
			if (typeof app.showNotice === 'function') {
				app.showNotice('Maximum ' + state.maxAttachments + ' files allowed per message', 'error');
			}
			return;
		}

		const filesToProcess = files.slice(0, remainingSlots);

		filesToProcess.forEach(function(file) {
			// Validate file type
			if (!state.allowedMimeTypes.includes(file.type)) {
				if (typeof app.showNotice === 'function') {
					app.showNotice('File type not supported: ' + file.name, 'error');
				}
				return;
			}

			// Validate file size
			if (file.size > state.maxFileSize) {
				if (typeof app.showNotice === 'function') {
					app.showNotice('File too large: ' + file.name + ' (max ' + Math.round(state.maxFileSize / 1024 / 1024) + 'MB)', 'error');
				}
				return;
			}

			// Process the file
			if (file.type.startsWith('image/') && file.size > state.maxImageSize) {
				// Resize large images
				attachments.resizeImage(file).then(function(resizedFile) {
					attachments.add(resizedFile);
				}).catch(function(err) {
					console.error('Image resize failed:', err);
					// Fall back to original
					attachments.add(file);
				});
			} else {
				attachments.add(file);
			}
		});
	};

	/**
	 * Add an attachment to pending list
	 * @param {File} file - File to add
	 */
	attachments.add = function(file) {
		attachments.fileToBase64(file).then(function(base64Data) {
			app.state.pendingAttachments.push({
				file: file,
				filename: file.name,
				mime_type: file.type,
				data: base64Data,
				preview: file.type.startsWith('image/') ? URL.createObjectURL(file) : null
			});
			attachments.updatePreviews();
		}).catch(function(err) {
			console.error('Failed to read file:', err);
			if (typeof app.showNotice === 'function') {
				app.showNotice('Failed to read file: ' + file.name, 'error');
			}
		});
	};

	/**
	 * Convert file to base64
	 * @param {File} file - File to convert
	 * @returns {Promise<string>} Base64 string
	 */
	attachments.fileToBase64 = function(file) {
		return new Promise(function(resolve, reject) {
			const reader = new FileReader();
			reader.onload = function() {
				// Remove data URL prefix to get pure base64
				const base64 = reader.result.split(',')[1];
				resolve(base64);
			};
			reader.onerror = reject;
			reader.readAsDataURL(file);
		});
	};

	/**
	 * Resize image if too large (browser-side)
	 * @param {File} file - Image file to resize
	 * @returns {Promise<File>} Resized file
	 */
	attachments.resizeImage = function(file) {
		return new Promise(function(resolve, reject) {
			const img = new Image();
			img.onload = function() {
				// Calculate new dimensions (max 1920px on longest side)
				const maxDim = 1920;
				let width = img.width;
				let height = img.height;

				if (width > maxDim || height > maxDim) {
					if (width > height) {
						height = Math.round((height / width) * maxDim);
						width = maxDim;
					} else {
						width = Math.round((width / height) * maxDim);
						height = maxDim;
					}
				}

				// Create canvas and resize
				const canvas = document.createElement('canvas');
				canvas.width = width;
				canvas.height = height;
				const ctx = canvas.getContext('2d');
				ctx.drawImage(img, 0, 0, width, height);

				// Convert to blob
				canvas.toBlob(function(blob) {
					if (blob) {
						// Create new file with same name
						const resizedFile = new File([blob], file.name, {
							type: 'image/jpeg',
							lastModified: Date.now()
						});
						resolve(resizedFile);
					} else {
						reject(new Error('Failed to create blob'));
					}
				}, 'image/jpeg', 0.85);
			};
			img.onerror = reject;
			img.src = URL.createObjectURL(file);
		});
	};

	/**
	 * Update attachment previews UI
	 */
	attachments.updatePreviews = function() {
		const state = app.state;
		const elements = app.elements;
		const $container = elements.attachmentPreviews;
		$container.empty();

		if (state.pendingAttachments.length === 0) {
			$container.hide();
			elements.attachButton.find('.aisales-attachment-count').remove();
			return;
		}

		state.pendingAttachments.forEach(function(attachment, index) {
			const isImage = attachment.mime_type.startsWith('image/');
			const isPdf = attachment.mime_type === 'application/pdf';

			let previewHtml = '<div class="aisales-attachment-preview" data-index="' + index + '">';

			if (isImage && attachment.preview) {
				previewHtml += '<img src="' + attachment.preview + '" alt="' + utils.escapeHtml(attachment.filename) + '">';
			} else if (isPdf) {
				previewHtml += '<div class="aisales-attachment-preview__icon"><span class="dashicons dashicons-pdf"></span></div>';
			} else {
				previewHtml += '<div class="aisales-attachment-preview__icon"><span class="dashicons dashicons-media-default"></span></div>';
			}

			previewHtml += '<div class="aisales-attachment-preview__name">' + utils.escapeHtml(utils.truncate(attachment.filename, 15)) + '</div>';
			previewHtml += '<button type="button" class="aisales-attachment-remove" title="Remove"><span class="dashicons dashicons-no-alt"></span></button>';
			previewHtml += '</div>';

			$container.append(previewHtml);
		});

		$container.show();

		// Update attachment count on button
		let $count = elements.attachButton.find('.aisales-attachment-count');
		if ($count.length === 0) {
			$count = $('<span class="aisales-attachment-count"></span>');
			elements.attachButton.append($count);
		}
		$count.text(state.pendingAttachments.length);
	};

	/**
	 * Clear all pending attachments
	 */
	attachments.clear = function() {
		const state = app.state;

		// Revoke object URLs to prevent memory leaks
		state.pendingAttachments.forEach(function(attachment) {
			if (attachment.preview) {
				URL.revokeObjectURL(attachment.preview);
			}
		});
		state.pendingAttachments = [];
		attachments.updatePreviews();
	};

	/**
	 * Get attachments for sending (formatted for API)
	 * @returns {Array} Array of attachment objects
	 */
	attachments.getForSending = function() {
		return app.state.pendingAttachments.map(function(a) {
			return {
				filename: a.filename,
				mime_type: a.mime_type,
				data: a.data
			};
		});
	};

	// Expose for backward compatibility
	window.AISalesChat.clearAttachments = attachments.clear;
	window.AISalesChat.updateAttachmentPreviews = attachments.updatePreviews;

})(jQuery);
