/**
 * AISales Chat - Images Module
 * 
 * Handles image generation, lightbox, and media library integration.
 *
 * @package AISales_Sales_Manager
 */

(function($) {
	'use strict';

	// Get shared app object
	const app = window.AISalesChat = window.AISalesChat || {};

	// Images module namespace
	const images = app.images = {};

	/**
	 * Initialize images module
	 */
	images.init = function() {
		images.bindEvents();
	};

	/**
	 * Bind image-related events
	 */
	images.bindEvents = function() {
		const elements = app.elements;
		// Generated image actions
		elements.messagesContainer.on('click', '.aisales-generated-image [data-action]', images.handleGeneratedImageAction);
		elements.messagesContainer.on('click', '.aisales-generated-image__expand', images.handleImageExpand);
		elements.messagesContainer.on('click', '.aisales-generated-image__img', images.handleImageExpand);
	};

	/**
	 * Show image generating indicator in chat
	 * @param {string} prompt - The prompt being used for generation
	 */
	images.showImageGeneratingIndicator = function(prompt) {
		const elements = app.elements;
		const escapeHtml = app.utils.escapeHtml;
		
		// Remove any existing indicator
		images.hideImageGeneratingIndicator();

		const truncatedPrompt = prompt && prompt.length > 80 ? prompt.substring(0, 80) + '...' : prompt;

		const indicatorHtml = 
			'<div class="aisales-image-generating">' +
				'<div class="aisales-image-generating__icon">' +
					'<div class="aisales-image-generating__icon-bg"></div>' +
					'<span class="dashicons dashicons-format-image"></span>' +
				'</div>' +
				'<div class="aisales-image-generating__content">' +
					'<p class="aisales-image-generating__title">Generating Image</p>' +
					'<p class="aisales-image-generating__desc">' + escapeHtml(truncatedPrompt || 'Creating your marketing image...') + '</p>' +
					'<div class="aisales-image-generating__progress">' +
						'<span class="aisales-image-generating__dot"></span>' +
						'<span class="aisales-image-generating__dot"></span>' +
						'<span class="aisales-image-generating__dot"></span>' +
					'</div>' +
				'</div>' +
			'</div>';

		// Always append as a standalone message for better visual presentation
		elements.messagesContainer.append(
			'<div class="aisales-message aisales-message--assistant aisales-message--image-generating">' +
				'<div class="aisales-message__avatar"><span class="dashicons dashicons-admin-site-alt3"></span></div>' +
				'<div class="aisales-message__content">' + indicatorHtml + '</div>' +
			'</div>'
		);
		
		// Scroll to bottom
		if (app.messaging && app.messaging.scrollToBottom) {
			app.messaging.scrollToBottom();
		} else {
			elements.messagesContainer.scrollTop(elements.messagesContainer[0].scrollHeight);
		}
	};

	/**
	 * Hide image generating indicator
	 */
	images.hideImageGeneratingIndicator = function() {
		const elements = app.elements;
		elements.messagesContainer.find('.aisales-image-generating').remove();
		elements.messagesContainer.find('.aisales-message--image-generating').remove();
	};

	/**
	 * Append generated image to chat
	 * @param {Object} data - Image data from API
	 */
	images.appendGeneratedImage = function(data) {
		const state = app.state;
		const elements = app.elements;
		const escapeHtml = app.utils.escapeHtml;

		const styleLabels = {
			'product': 'Product Showcase',
			'lifestyle': 'Lifestyle',
			'promotional': 'Promotional',
			'minimal': 'Minimal',
			'artistic': 'Artistic'
		};

		const aspectLabels = {
			'1:1': 'Square',
			'16:9': 'Landscape',
			'9:16': 'Portrait',
			'4:3': 'Standard',
			'3:4': 'Portrait'
		};

		const styleLabel = styleLabels[data.style] || data.style || 'Generated';
		const aspectLabel = aspectLabels[data.aspect_ratio] || data.aspect_ratio || '';

		// Determine entity context for action buttons
		const entityType = data.entity_type || state.entityType;
		const entityId = data.entity_id || (entityType === 'product' ? (state.selectedProduct ? state.selectedProduct.id : null) : (entityType === 'category' ? (state.selectedCategory ? state.selectedCategory.id : null) : null));

		// Build contextual action buttons
		let actionsHtml = '<div class="aisales-generated-image__actions">' +
			'<button type="button" class="aisales-inline-option aisales-inline-option--primary" data-action="save-to-media" data-url="' + escapeHtml(data.url) + '">' +
				'<span class="dashicons dashicons-download"></span>Save to Media Library' +
			'</button>';

		// Add "Set as Featured Image" button for products
		if (entityType === 'product' && entityId) {
			actionsHtml += '<button type="button" class="aisales-inline-option aisales-inline-option--success" data-action="set-featured-image" data-url="' + escapeHtml(data.url) + '" data-entity-id="' + entityId + '">' +
				'<span class="dashicons dashicons-star-filled"></span>Set as Featured Image' +
			'</button>';
		}

		// Add "Set as Thumbnail" button for categories
		if (entityType === 'category' && entityId) {
			actionsHtml += '<button type="button" class="aisales-inline-option aisales-inline-option--success" data-action="set-category-thumbnail" data-url="' + escapeHtml(data.url) + '" data-entity-id="' + entityId + '">' +
				'<span class="dashicons dashicons-star-filled"></span>Set as Category Thumbnail' +
			'</button>';
		}

		actionsHtml += '<button type="button" class="aisales-inline-option" data-option-value="Try a different style for this image">' +
				'Different style' +
			'</button>' +
			'<button type="button" class="aisales-inline-option" data-option-value="Change the aspect ratio of this image">' +
				'Change ratio' +
			'</button>' +
			'<button type="button" class="aisales-inline-option" data-option-value="Regenerate this image with the same settings">' +
				'Regenerate' +
			'</button>' +
		'</div>';

		const $image = $(
			'<div class="aisales-generated-image" data-image-url="' + escapeHtml(data.url) + '" data-entity-type="' + escapeHtml(entityType) + '" data-entity-id="' + (entityId || '') + '">' +
				'<div class="aisales-generated-image__preview">' +
					'<img src="' + escapeHtml(data.url) + '" alt="Generated marketing image" class="aisales-generated-image__img">' +
					(aspectLabel ? '<span class="aisales-generated-image__badge"><span class="dashicons dashicons-image-crop"></span>' + escapeHtml(aspectLabel) + '</span>' : '') +
					'<button type="button" class="aisales-generated-image__expand" title="View full size"><span class="dashicons dashicons-fullscreen-alt"></span></button>' +
				'</div>' +
				'<div class="aisales-generated-image__info">' +
					'<span class="aisales-generated-image__style"><span class="dashicons dashicons-art"></span>' + escapeHtml(styleLabel) + '</span>' +
				'</div>' +
				actionsHtml +
			'</div>'
		);

		// Append to current streaming message or last assistant message
		let $target = elements.messagesContainer.find('[data-streaming="true"] .aisales-message__text');
		if (!$target.length) {
			$target = elements.messagesContainer.find('.aisales-message--assistant').last().find('.aisales-message__text');
		}

		if ($target.length) {
			$target.append($image);
		}
		
		// Scroll to bottom
		if (app.messaging && app.messaging.scrollToBottom) {
			app.messaging.scrollToBottom();
		} else {
			elements.messagesContainer.scrollTop(elements.messagesContainer[0].scrollHeight);
		}
	};

	/**
	 * Handle generated image actions (save to media library, set as featured, etc.)
	 * @param {Event} e - Click event
	 */
	images.handleGeneratedImageAction = function(e) {
		const $btn = $(e.currentTarget);
		const action = $btn.data('action');
		const url = $btn.data('url');
		const entityId = $btn.data('entity-id');

		if (action === 'save-to-media' && url) {
			images.saveImageToMediaLibrary($btn, url);
		} else if (action === 'set-featured-image' && url && entityId) {
			images.setProductFeaturedImage($btn, url, entityId);
		} else if (action === 'set-category-thumbnail' && url && entityId) {
			images.setCategoryThumbnail($btn, url, entityId);
		}
	};

	/**
	 * Save generated image to WordPress Media Library
	 * @param {jQuery} $btn - Button element
	 * @param {string} imageUrl - URL of the image to save
	 */
	images.saveImageToMediaLibrary = function($btn, imageUrl) {
		// Show saving state
		$btn.addClass('aisales-inline-option--saving').prop('disabled', true);
		const originalText = $btn.html();

		$.ajax({
			url: aisalesChat.ajaxUrl,
			method: 'POST',
			data: {
				action: 'aisales_save_generated_image',
				nonce: aisalesChat.nonce,
				image_url: imageUrl
			},
			success: function(response) {
				$btn.removeClass('aisales-inline-option--saving');
				
				if (response.success) {
					$btn.addClass('aisales-inline-option--saved')
						.html('<span class="dashicons dashicons-yes"></span>Saved!')
						.closest('.aisales-generated-image')
						.addClass('aisales-generated-image--saved');
					
					if (app.showNotice) {
						app.showNotice('Image saved to Media Library', 'success');
					}
				} else {
					$btn.prop('disabled', false).html(originalText);
					if (app.showNotice) {
						app.showNotice(response.data || 'Failed to save image', 'error');
					}
				}
			},
			error: function() {
				$btn.removeClass('aisales-inline-option--saving').prop('disabled', false).html(originalText);
				if (app.showNotice) {
					app.showNotice('Failed to save image. Please try again.', 'error');
				}
			}
		});
	};

	/**
	 * Set generated image as product featured image
	 * @param {jQuery} $btn - Button element
	 * @param {string} imageUrl - URL of the image
	 * @param {number} productId - Product ID
	 */
	images.setProductFeaturedImage = function($btn, imageUrl, productId) {
		const state = app.state;
		
		// Show saving state
		$btn.addClass('aisales-inline-option--saving').prop('disabled', true);
		const originalText = $btn.html();

		$.ajax({
			url: aisalesChat.ajaxUrl,
			method: 'POST',
			data: {
				action: 'aisales_set_product_featured_image',
				nonce: aisalesChat.nonce,
				image_url: imageUrl,
				product_id: productId
			},
			success: function(response) {
				$btn.removeClass('aisales-inline-option--saving');
				
				if (response.success) {
					$btn.addClass('aisales-inline-option--saved')
						.html('<span class="dashicons dashicons-yes"></span>Featured Image Set!');
					
					if (app.showNotice) {
						app.showNotice('Image set as product featured image', 'success');
					}

					// Update the product image in the entity panel if it's the current product
					if (state.selectedProduct && state.selectedProduct.id == productId && response.data.image_url) {
						state.selectedProduct.image = response.data.image_url;
						$('#aisales-product-image').attr('src', response.data.image_url);
					}
				} else {
					$btn.prop('disabled', false).html(originalText);
					if (app.showNotice) {
						app.showNotice(response.data || 'Failed to set featured image', 'error');
					}
				}
			},
			error: function() {
				$btn.removeClass('aisales-inline-option--saving').prop('disabled', false).html(originalText);
				if (app.showNotice) {
					app.showNotice('Failed to set featured image. Please try again.', 'error');
				}
			}
		});
	};

	/**
	 * Set generated image as category thumbnail
	 * @param {jQuery} $btn - Button element
	 * @param {string} imageUrl - URL of the image
	 * @param {number} categoryId - Category ID
	 */
	images.setCategoryThumbnail = function($btn, imageUrl, categoryId) {
		const state = app.state;
		
		// Show saving state
		$btn.addClass('aisales-inline-option--saving').prop('disabled', true);
		const originalText = $btn.html();

		$.ajax({
			url: aisalesChat.ajaxUrl,
			method: 'POST',
			data: {
				action: 'aisales_set_category_thumbnail',
				nonce: aisalesChat.nonce,
				image_url: imageUrl,
				category_id: categoryId
			},
			success: function(response) {
				$btn.removeClass('aisales-inline-option--saving');
				
				if (response.success) {
					$btn.addClass('aisales-inline-option--saved')
						.html('<span class="dashicons dashicons-yes"></span>Thumbnail Set!');
					
					if (app.showNotice) {
						app.showNotice('Image set as category thumbnail', 'success');
					}

					// Update the category thumbnail in the entity panel if it's the current category
					if (state.selectedCategory && state.selectedCategory.id == categoryId && response.data.image_url) {
						state.selectedCategory.thumbnail = response.data.image_url;
						$('#aisales-category-thumbnail').attr('src', response.data.image_url);
					}
				} else {
					$btn.prop('disabled', false).html(originalText);
					if (app.showNotice) {
						app.showNotice(response.data || 'Failed to set category thumbnail', 'error');
					}
				}
			},
			error: function() {
				$btn.removeClass('aisales-inline-option--saving').prop('disabled', false).html(originalText);
				if (app.showNotice) {
					app.showNotice('Failed to set category thumbnail. Please try again.', 'error');
				}
			}
		});
	};

	/**
	 * Handle image expand (lightbox)
	 * @param {Event} e - Click event
	 */
	images.handleImageExpand = function(e) {
		const $target = $(e.currentTarget);
		const imageUrl = $target.closest('.aisales-generated-image').data('image-url') || $target.attr('src');

		if (!imageUrl) return;

		// Create lightbox if it doesn't exist
		let $lightbox = $('#aisales-lightbox');
		if (!$lightbox.length) {
			$lightbox = $(
				'<div id="aisales-lightbox" class="aisales-lightbox">' +
					'<div class="aisales-lightbox__content">' +
						'<img src="" alt="Full size preview" class="aisales-lightbox__img">' +
						'<button type="button" class="aisales-lightbox__close"><span class="dashicons dashicons-no-alt"></span></button>' +
					'</div>' +
				'</div>'
			);
			$('body').append($lightbox);

			// Bind close events
			$lightbox.on('click', function(e) {
				if (e.target === this) {
					images.closeLightbox();
				}
			});
			$lightbox.find('.aisales-lightbox__close').on('click', images.closeLightbox);
			$(document).on('keydown.lightbox', function(e) {
				if (e.key === 'Escape') {
					images.closeLightbox();
				}
			});
		}

		// Update image and show
		$lightbox.find('.aisales-lightbox__img').attr('src', imageUrl);
		$lightbox.addClass('aisales-lightbox--open');
		$('body').css('overflow', 'hidden');
	};

	/**
	 * Close lightbox
	 */
	images.closeLightbox = function() {
		$('#aisales-lightbox').removeClass('aisales-lightbox--open');
		$('body').css('overflow', '');
	};

	/**
	 * Show image generation modal
	 * @param {string} entityType - Type of entity (product, category, agent)
	 */
	images.showImageGenerationModal = function(entityType) {
		const escapeHtml = app.utils.escapeHtml;
		
		// Remove existing modal if any
		$('#aisales-image-gen-modal').remove();

		const entityLabel = entityType === 'category' ? 'category thumbnail' : (entityType === 'product' ? 'product image' : 'marketing image');
		const defaultStyle = entityType === 'category' ? 'promotional' : 'product';
		const defaultAspect = entityType === 'category' ? '16:9' : '1:1';

		const modalHtml = 
			'<div id="aisales-image-gen-modal" class="aisales-modal aisales-modal--fullscreen">' +
				'<div class="aisales-modal__backdrop"></div>' +
				'<div class="aisales-modal__content">' +
					'<div class="aisales-modal__header">' +
						'<h3 class="aisales-modal__title"><span class="dashicons dashicons-format-image"></span> Generate ' + escapeHtml(entityLabel.charAt(0).toUpperCase() + entityLabel.slice(1)) + '</h3>' +
						'<button type="button" class="aisales-modal__close"><span class="dashicons dashicons-no-alt"></span></button>' +
					'</div>' +
					'<div class="aisales-modal__body">' +
						'<div class="aisales-form-group">' +
							'<label class="aisales-form-label">Style</label>' +
							'<div class="aisales-option-grid" data-option="style">' +
								'<button type="button" class="aisales-option-btn' + (defaultStyle === 'product' ? ' aisales-option-btn--selected' : '') + '" data-value="product">' +
									'<span class="dashicons dashicons-products"></span>' +
									'<span class="aisales-option-btn__label">Product Showcase</span>' +
									'<span class="aisales-option-btn__desc">Clean, professional product photos</span>' +
								'</button>' +
								'<button type="button" class="aisales-option-btn' + (defaultStyle === 'lifestyle' ? ' aisales-option-btn--selected' : '') + '" data-value="lifestyle">' +
									'<span class="dashicons dashicons-camera"></span>' +
									'<span class="aisales-option-btn__label">Lifestyle</span>' +
									'<span class="aisales-option-btn__desc">Product in real-world context</span>' +
								'</button>' +
								'<button type="button" class="aisales-option-btn' + (defaultStyle === 'promotional' ? ' aisales-option-btn--selected' : '') + '" data-value="promotional">' +
									'<span class="dashicons dashicons-megaphone"></span>' +
									'<span class="aisales-option-btn__label">Promotional</span>' +
									'<span class="aisales-option-btn__desc">Eye-catching marketing visuals</span>' +
								'</button>' +
								'<button type="button" class="aisales-option-btn' + (defaultStyle === 'minimal' ? ' aisales-option-btn--selected' : '') + '" data-value="minimal">' +
									'<span class="dashicons dashicons-minus"></span>' +
									'<span class="aisales-option-btn__label">Minimal</span>' +
									'<span class="aisales-option-btn__desc">Simple, clean background</span>' +
								'</button>' +
								'<button type="button" class="aisales-option-btn' + (defaultStyle === 'artistic' ? ' aisales-option-btn--selected' : '') + '" data-value="artistic">' +
									'<span class="dashicons dashicons-art"></span>' +
									'<span class="aisales-option-btn__label">Artistic</span>' +
									'<span class="aisales-option-btn__desc">Creative, unique compositions</span>' +
								'</button>' +
							'</div>' +
						'</div>' +
						'<div class="aisales-form-group">' +
							'<label class="aisales-form-label">Aspect Ratio</label>' +
							'<div class="aisales-option-grid aisales-option-grid--compact" data-option="aspect">' +
								'<button type="button" class="aisales-option-btn' + (defaultAspect === '1:1' ? ' aisales-option-btn--selected' : '') + '" data-value="1:1">' +
									'<span class="aisales-aspect-icon aisales-aspect-icon--square"></span>' +
									'<span class="aisales-option-btn__label">Square (1:1)</span>' +
									'<span class="aisales-option-btn__desc">Instagram, Product images</span>' +
								'</button>' +
								'<button type="button" class="aisales-option-btn' + (defaultAspect === '16:9' ? ' aisales-option-btn--selected' : '') + '" data-value="16:9">' +
									'<span class="aisales-aspect-icon aisales-aspect-icon--landscape"></span>' +
									'<span class="aisales-option-btn__label">Landscape (16:9)</span>' +
									'<span class="aisales-option-btn__desc">Banners, Category headers</span>' +
								'</button>' +
								'<button type="button" class="aisales-option-btn' + (defaultAspect === '9:16' ? ' aisales-option-btn--selected' : '') + '" data-value="9:16">' +
									'<span class="aisales-aspect-icon aisales-aspect-icon--portrait"></span>' +
									'<span class="aisales-option-btn__label">Portrait (9:16)</span>' +
									'<span class="aisales-option-btn__desc">Stories, Mobile ads</span>' +
								'</button>' +
								'<button type="button" class="aisales-option-btn' + (defaultAspect === '4:3' ? ' aisales-option-btn--selected' : '') + '" data-value="4:3">' +
									'<span class="aisales-aspect-icon aisales-aspect-icon--standard"></span>' +
									'<span class="aisales-option-btn__label">Standard (4:3)</span>' +
									'<span class="aisales-option-btn__desc">Traditional format</span>' +
								'</button>' +
								'<button type="button" class="aisales-option-btn' + (defaultAspect === '3:4' ? ' aisales-option-btn--selected' : '') + '" data-value="3:4">' +
									'<span class="aisales-aspect-icon aisales-aspect-icon--tall"></span>' +
									'<span class="aisales-option-btn__label">Tall (3:4)</span>' +
									'<span class="aisales-option-btn__desc">Pinterest, Product cards</span>' +
								'</button>' +
							'</div>' +
						'</div>' +
					'</div>' +
					'<div class="aisales-modal__footer">' +
						'<button type="button" class="aisales-btn aisales-btn--outline" data-action="cancel">Cancel</button>' +
						'<button type="button" class="aisales-btn aisales-btn--primary" data-action="generate">' +
							'<span class="dashicons dashicons-format-image"></span> Generate Image' +
						'</button>' +
					'</div>' +
				'</div>' +
			'</div>';

		$('body').append(modalHtml);

		const $modal = $('#aisales-image-gen-modal');
		let selectedStyle = defaultStyle;
		let selectedAspect = defaultAspect;

		// Show modal with animation
		setTimeout(function() {
			$modal.addClass('aisales-modal--open');
		}, 10);

		// Handle style/aspect selection
		$modal.on('click', '.aisales-option-btn', function() {
			const $btn = $(this);
			const $grid = $btn.closest('.aisales-option-grid');
			const optionType = $grid.data('option');
			const value = $btn.data('value');

			$grid.find('.aisales-option-btn').removeClass('aisales-option-btn--selected');
			$btn.addClass('aisales-option-btn--selected');

			if (optionType === 'style') {
				selectedStyle = value;
			} else if (optionType === 'aspect') {
				selectedAspect = value;
			}
		});

		// Handle close
		$modal.on('click', '.aisales-modal__close, .aisales-modal__backdrop, [data-action="cancel"]', function() {
			images.closeImageGenerationModal();
		});

		// Handle generate
		$modal.on('click', '[data-action="generate"]', function() {
			images.closeImageGenerationModal();
			
			// Build the message with selected options
			let message = 'Generate a ' + selectedStyle + ' style image with ' + selectedAspect + ' aspect ratio';
			if (entityType === 'product') {
				message += ' for this product';
			} else if (entityType === 'category') {
				message += ' for this category';
			}
			
			// Send the message
			if (app.sendMessage) {
				app.sendMessage(message);
			}
		});

		// Handle escape key
		$(document).on('keydown.imageGenModal', function(e) {
			if (e.key === 'Escape') {
				images.closeImageGenerationModal();
			}
		});
	};

	/**
	 * Close image generation modal
	 */
	images.closeImageGenerationModal = function() {
		const $modal = $('#aisales-image-gen-modal');
		$modal.removeClass('aisales-modal--open');
		$(document).off('keydown.imageGenModal');
		setTimeout(function() {
			$modal.remove();
		}, 300);
	};

	/**
	 * Save generated image with data (base64)
	 * @param {string} imageData - Base64 image data
	 * @param {string} filename - Filename for the image
	 * @param {string} title - Title for the media library
	 * @returns {Promise} - Resolves with attachment data or rejects with error
	 */
	images.saveGeneratedImage = function(imageData, filename, title) {
		return new Promise(function(resolve, reject) {
			$.ajax({
				url: aisalesChat.ajaxUrl,
				type: 'POST',
				data: {
					action: 'aisales_save_generated_image',
					nonce: aisalesChat.nonce,
					image_data: imageData,
					filename: filename || 'ai-generated-image.png',
					title: title || ''
				},
				success: function(response) {
					if (response.success) {
						if (app.showNotice) {
							app.showNotice(response.data.message || 'Image saved to media library', 'success');
						}
						resolve(response.data);
					} else {
						if (app.showNotice) {
							app.showNotice(response.data.message || 'Failed to save image', 'error');
						}
						reject(new Error(response.data.message || 'Failed to save image'));
					}
				},
				error: function(xhr) {
					let message = 'Failed to save image';
					if (xhr.responseJSON && xhr.responseJSON.data && xhr.responseJSON.data.message) {
						message = xhr.responseJSON.data.message;
					}
					if (app.showNotice) {
						app.showNotice(message, 'error');
					}
					reject(new Error(message));
				}
			});
		});
	};

})(jQuery);
