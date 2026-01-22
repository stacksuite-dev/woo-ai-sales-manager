/**
 * Bulk Enhancement JavaScript
 *
 * Handles the multi-step bulk product enhancement wizard.
 *
 * @package AISales_Sales_Manager
 */

(function($) {
	'use strict';

	// ==========================================================================
	// STATE MANAGEMENT
	// ==========================================================================

	const state = {
		// Current step (1-5)
		currentStep: 1,

		// Products
		products: [],
		filteredProducts: [],
		selectedProductIds: new Set(),

		// Configuration
		enhancements: ['description', 'short_description'],
		userDirection: '',

		// Job data
		jobId: null,
		jobStatus: null,

		// Preview
		previewResults: [],
		previewProductIndex: 0,

		// Processing
		isProcessing: false,
		isPaused: false,
		processedItems: 0,
		successfulItems: 0,
		failedItems: 0,
		tokensUsed: 0,

		// Results
		results: [],
		selectedResultIds: new Set(),

		// Attachments
		uploadedAttachments: [],

		// Balance
		balance: 0,
	};

	// ==========================================================================
	// CONFIGURATION
	// ==========================================================================

	const config = {
		ajaxUrl: '',
		nonce: '',
		apiBaseUrl: '',
		apiKey: '',
		previewSize: 5,
		batchSize: 10,
		i18n: {},
	};

	// Token estimates per enhancement type
	const TOKEN_ESTIMATES = {
		description: { input: 500, output: 300 },
		short_description: { input: 400, output: 100 },
		seo_title: { input: 300, output: 50 },
		seo_description: { input: 350, output: 80 },
		tags: { input: 300, output: 50 },
		categories: { input: 400, output: 50 },
		image_alt: { input: 300, output: 30 },
	};

	// Enhancement labels
	const ENHANCEMENT_LABELS = {
		description: 'Description',
		short_description: 'Short Description',
		seo_title: 'SEO Title',
		seo_description: 'SEO Meta',
		tags: 'Tags',
		categories: 'Categories',
		image_alt: 'Image Alt',
	};

	// ==========================================================================
	// INITIALIZATION
	// ==========================================================================

	function init() {
		// Load config from localized script
		if (typeof aisalesBatch !== 'undefined') {
			config.ajaxUrl = aisalesBatch.ajaxUrl;
			config.nonce = aisalesBatch.nonce;
			config.apiBaseUrl = aisalesBatch.apiBaseUrl;
			config.apiKey = aisalesBatch.apiKey;
			config.previewSize = aisalesBatch.previewSize || 5;
			config.batchSize = aisalesBatch.batchSize || 10;
			config.i18n = aisalesBatch.i18n || {};
			state.products = aisalesBatch.products || [];
			state.filteredProducts = [...state.products];
			state.balance = parseInt(aisalesBatch.balance, 10) || 0;

			// Populate category filter
			populateCategoryFilter(aisalesBatch.categories || []);
		}

		// Bind events
		bindEvents();

		// Initial render
		renderProducts();
		updateSelectedCount();
		updateEnhancements();
		updateTokenEstimate();
	}

	function bindEvents() {
		// Step navigation
		$('#aisales-step1-next').on('click', goToStep2);
		$('#aisales-step2-back').on('click', goToStep1);
		$('#aisales-step2-next').on('click', goToStep3);
		$('#aisales-step3-back').on('click', goToStep2);
		$('#aisales-approve-preview').on('click', approveAndProcess);
		$('#aisales-cancel-batch').on('click', cancelBatch);
		$('#aisales-new-batch').on('click', startNewBatch);

		// Product selection
		$('#aisales-products-grid').on('click', '.aisales-product-card', toggleProductSelection);
		$('#aisales-select-all').on('click', selectAllVisible);
		$('#aisales-deselect-all').on('click', deselectAll);

		// Filters
		$('#aisales-product-search').on('input', debounce(filterProducts, 300));
		$('#aisales-category-filter').on('change', filterProducts);
		$('#aisales-status-filter').on('change', filterProducts);

		// Enhancement options
		$('input[name="enhancements[]"]').on('change', updateEnhancements);
		$('#aisales-direction').on('input', function() {
			state.userDirection = $(this).val();
		});

		// Refinement panel toggle
		$('#aisales-refinement-toggle').on('click', toggleRefinementPanel);
		$('#aisales-regenerate-preview').on('click', regeneratePreview);

		// File upload
		$('#aisales-dropzone').on('click', function() {
			$('#aisales-refinement-files').trigger('click');
		});
		$('#aisales-refinement-files').on('change', handleFileSelect);
		setupDragDrop();

		// Processing controls
		$('#aisales-pause-process').on('click', pauseProcessing);
		$('#aisales-resume-process').on('click', resumeProcessing);
		$('#aisales-cancel-process').on('click', cancelProcessing);

		// Results
		$('#aisales-select-all-results').on('change', toggleAllResults);
		$('#aisales-results-body').on('change', '.aisales-result-checkbox', updateApplyCount);
		$('#aisales-results-body').on('click', '.aisales-view-details', viewResultDetails);
		$('#aisales-apply-results').on('click', applyResults);
		$('#aisales-retry-failed').on('click', retryFailedItems);
		
		// Modal
		$('#aisales-result-modal-close').on('click', closeResultModal);
		$('#aisales-result-modal-overlay').on('click', closeResultModal);
		$(document).on('keydown', function(e) {
			if (e.key === 'Escape' && $('#aisales-result-modal').hasClass('aisales-modal--active')) {
				closeResultModal();
			}
		});
	}

	// ==========================================================================
	// STEP NAVIGATION
	// ==========================================================================

	function setStep(step) {
		state.currentStep = step;

		// Update step indicators
		$('.aisales-batch-step').each(function() {
			const stepNum = parseInt($(this).data('step'), 10);
			$(this).removeClass('aisales-batch-step--active aisales-batch-step--completed');

			if (stepNum < step) {
				$(this).addClass('aisales-batch-step--completed');
			} else if (stepNum === step) {
				$(this).addClass('aisales-batch-step--active');
			}
		});

		// Show/hide panels
		$('.aisales-batch-panel').hide();
		$('#aisales-step-' + step).show();
	}

	function goToStep1() {
		// Reset job if going back - user may change selections
		if (state.jobId) {
			state.jobId = null;
			state.previewResults = [];
		}
		setStep(1);
	}

	function goToStep2() {
		if (state.selectedProductIds.size === 0) {
			showNotice(config.i18n.error || 'Error', 'Please select at least one product.', 'error');
			return;
		}
		// Reset job if going back from step 3 - user may change enhancements
		if (state.currentStep === 3 && state.jobId) {
			state.jobId = null;
			state.previewResults = [];
		}
		setStep(2);
		updateTokenEstimate();
	}

	function goToStep3() {
		if (state.enhancements.length === 0) {
			showNotice(config.i18n.error || 'Error', 'Please select at least one enhancement type.', 'error');
			return;
		}
		setStep(3);
		generatePreview();
	}

	// ==========================================================================
	// STEP 1: PRODUCT SELECTION
	// ==========================================================================

	function populateCategoryFilter(categories) {
		const $select = $('#aisales-category-filter');
		categories.forEach(function(cat) {
			$select.append($('<option>', {
				value: cat.slug,
				text: cat.name,
			}));
		});
	}

	function renderProducts() {
		const $grid = $('#aisales-products-grid');
		$grid.empty();

		if (state.filteredProducts.length === 0) {
			$grid.html('<div class="aisales-batch-products__empty">' + (config.i18n.noProductsFound || 'No products found') + '</div>');
			return;
		}

		state.filteredProducts.forEach(function(product) {
			const isSelected = state.selectedProductIds.has(product.id);
			const statusLabel = product.status.charAt(0).toUpperCase() + product.status.slice(1);
			const categories = product.categories ? product.categories.join(', ') : '';
			const imageUrl = product.image_url || 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"%3E%3Cpath fill="%23ccc" d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z"/%3E%3C/svg%3E';
			const price = product.price ? '$' + product.price : '';

			const $card = $(`
				<div class="aisales-product-card ${isSelected ? 'aisales-product-card--selected' : ''}" data-product-id="${product.id}">
					<div class="aisales-product-card__checkbox">
						<input type="checkbox" name="products[]" value="${product.id}" ${isSelected ? 'checked' : ''}>
					</div>
					<div class="aisales-product-card__image">
						<img src="${imageUrl}" alt="${escapeHtml(product.title)}">
					</div>
					<div class="aisales-product-card__content">
						<div class="aisales-product-card__title">${escapeHtml(product.title)}</div>
						<div class="aisales-product-card__meta">
							<span class="aisales-product-card__price">${price}</span>
							<span class="aisales-product-card__status aisales-product-card__status--${product.status}">${statusLabel}</span>
						</div>
						<div class="aisales-product-card__categories">${escapeHtml(categories)}</div>
					</div>
				</div>
			`);

			$grid.append($card);
		});
	}

	function toggleProductSelection(e) {
		// Don't toggle if clicking on the checkbox directly
		if ($(e.target).is('input[type="checkbox"]')) {
			e.stopPropagation();
		}

		const $card = $(this);
		const productId = $card.data('product-id').toString();
		const $checkbox = $card.find('input[type="checkbox"]');

		if (state.selectedProductIds.has(productId)) {
			state.selectedProductIds.delete(productId);
			$card.removeClass('aisales-product-card--selected');
			$checkbox.prop('checked', false);
		} else {
			state.selectedProductIds.add(productId);
			$card.addClass('aisales-product-card--selected');
			$checkbox.prop('checked', true);
		}

		updateSelectedCount();
	}

	function selectAllVisible() {
		state.filteredProducts.forEach(function(product) {
			state.selectedProductIds.add(product.id);
		});
		renderProducts();
		updateSelectedCount();
	}

	function deselectAll() {
		state.selectedProductIds.clear();
		renderProducts();
		updateSelectedCount();
	}

	function updateSelectedCount() {
		const count = state.selectedProductIds.size;
		$('#aisales-selected-count').text(count);
		$('#aisales-step1-next').prop('disabled', count === 0);
	}

	function filterProducts() {
		const search = $('#aisales-product-search').val().toLowerCase();
		const category = $('#aisales-category-filter').val();
		const status = $('#aisales-status-filter').val();

		state.filteredProducts = state.products.filter(function(product) {
			// Search filter
			if (search && !product.title.toLowerCase().includes(search)) {
				return false;
			}

			// Category filter
			if (category && product.categories) {
				const productCatSlugs = product.categories.map(function(c) {
					return c.toLowerCase().replace(/\s+/g, '-');
				});
				if (!productCatSlugs.some(function(slug) {
					return slug.includes(category.toLowerCase());
				})) {
					// Also check category names
					if (!product.categories.some(function(cat) {
						return cat.toLowerCase().includes(category.toLowerCase());
					})) {
						return false;
					}
				}
			}

			// Status filter
			if (status && product.status !== status) {
				return false;
			}

			return true;
		});

		renderProducts();
	}

	// ==========================================================================
	// STEP 2: CONFIGURATION
	// ==========================================================================

	function updateEnhancements() {
		state.enhancements = [];
		$('input[name="enhancements[]"]:checked').each(function() {
			state.enhancements.push($(this).val());
		});

		updateTokenEstimate();
		$('#aisales-step2-next').prop('disabled', state.enhancements.length === 0);
	}

	function updateTokenEstimate() {
		const productCount = state.selectedProductIds.size;
		const enhancementCount = state.enhancements.length;

		let perProductTokens = 0;
		state.enhancements.forEach(function(enhancement) {
			const estimate = TOKEN_ESTIMATES[enhancement];
			if (estimate) {
				perProductTokens += estimate.input + estimate.output * 1.5;
			}
		});

		const overhead = 500;
		const batchEfficiency = 0.7;
		const estimatedTokens = Math.ceil((perProductTokens * productCount * batchEfficiency) + overhead);

		$('#aisales-estimate-products').text(productCount);
		$('#aisales-estimate-enhancements').text(enhancementCount);
		$('#aisales-estimate-tokens').text('~' + numberFormat(estimatedTokens));
		$('#aisales-estimate-balance').text(numberFormat(state.balance));

		// Check if balance is sufficient
		if (state.balance < estimatedTokens) {
			$('#aisales-estimate-balance').addClass('aisales-text-danger');
		} else {
			$('#aisales-estimate-balance').removeClass('aisales-text-danger');
		}
	}

	// ==========================================================================
	// STEP 3: PREVIEW & REFINEMENT
	// ==========================================================================

	async function generatePreview() {
		$('#aisales-preview-loading').show();
		$('#aisales-preview-results').hide();
		$('#aisales-step3-actions').hide();

		// Reset progress
		$('#aisales-preview-progress').css('width', '0%');
		state.previewResults = [];

		try {
			// Get preview products (first N selected)
			const selectedProducts = getSelectedProducts().slice(0, config.previewSize);
			const previewCount = selectedProducts.length;

			// Update status with actual count
			$('#aisales-preview-status').text(`AI is analyzing ${previewCount} sample product${previewCount !== 1 ? 's' : ''} to create suggestions.`);
			
			// Update the preview count badge
			$('#aisales-preview-count-badge').text(`${previewCount} sample product${previewCount !== 1 ? 's' : ''}`);

			// Create job if not exists
			if (!state.jobId) {
				$('#aisales-preview-status').text('Creating batch job...');
				const createResponse = await apiRequest('POST', '/ai/batch/jobs', {
					job_type: 'bulk_enhance',
					product_ids: Array.from(state.selectedProductIds),
					options: {
						enhancements: state.enhancements,
					},
					store_context: aisalesBatch.storeContext || {},
					user_direction: state.userDirection,
				});

				if (createResponse.error) {
					throw new Error(createResponse.message || createResponse.error || 'Failed to create job');
				}

				state.jobId = createResponse.job.id;
			}

			// Generate preview with SSE for real-time updates
			$('#aisales-preview-status').text('Connecting to AI...');
			$('#aisales-preview-progress').css('width', '10%');

			let receivedProducts = 0;
			const totalProducts = selectedProducts.length;

			const result = await apiRequestSSE(
				`/ai/batch/jobs/${state.jobId}/preview`,
				{ products: selectedProducts.map(formatProductForApi) },
				{
					onStart: function(data) {
						$('#aisales-preview-status').text(data.message || 'Starting...');
						$('#aisales-preview-progress').css('width', '15%');
					},
					onProcessing: function(data) {
						$('#aisales-preview-status').text(data.message || 'AI is analyzing products...');
						$('#aisales-preview-progress').css('width', '30%');
					},
					onProductResult: function(data) {
						// Add product result progressively
						state.previewResults.push(data);
						receivedProducts++;
						
						// Update progress
						const progress = 30 + (receivedProducts / totalProducts) * 60;
						$('#aisales-preview-progress').css('width', progress + '%');
						$('#aisales-preview-status').text(`Generated: ${data.product_name}`);
						
						// Progressively render results
						addPreviewResult(data, receivedProducts - 1);
					},
					onBalanceUpdate: function(data) {
						state.balance = data.new_balance;
						updateBalanceDisplay();
					},
					onDone: function(data) {
						$('#aisales-preview-progress').css('width', '100%');
						$('#aisales-preview-status').text('Complete!');
					},
					onError: function(data) {
						throw new Error(data.message || 'Preview generation failed');
					}
				}
			);

			// Finalize UI
			setTimeout(function() {
				$('#aisales-preview-loading').hide();
				$('#aisales-preview-results').show();
				$('#aisales-step3-actions').show();
				// Re-render to ensure everything is properly styled
				renderPreviewResults();
			}, 300);

		} catch (error) {
			$('#aisales-preview-loading').hide();
			showNotice(config.i18n.error || 'Error', error.message, 'error');
			setStep(2);
		}
	}

	/**
	 * Add a single preview result to the UI progressively
	 */
	function addPreviewResult(result, index) {
		const $tabs = $('#aisales-preview-tabs');
		const $content = $('#aisales-preview-content');

		// Show preview results container if first result
		if (index === 0) {
			$('#aisales-preview-results').show();
		}

		// Create tab
		const $tab = $(`
			<button type="button" class="aisales-preview-tab ${index === 0 ? 'aisales-preview-tab--active' : ''}" data-index="${index}">
				${escapeHtml(result.product_name)}
			</button>
		`);
		$tab.on('click', function() {
			switchPreviewTab(index);
		});
		$tabs.append($tab);

		// Create content
		const product = getProductById(result.product_id);
		const $productContent = $(`
			<div class="aisales-preview-product ${index === 0 ? 'aisales-preview-product--active' : ''}" data-index="${index}">
				<div class="aisales-preview-product__header">
					<img src="${product ? product.image_url || '' : ''}" alt="" class="aisales-preview-product__image">
					<div class="aisales-preview-product__info">
						<h4>${escapeHtml(result.product_name)}</h4>
						<span>ID: ${result.product_id}</span>
					</div>
				</div>
				<div class="aisales-diff-fields">
					${renderDiffFields(result.suggestions, product)}
				</div>
			</div>
		`);
		$content.append($productContent);

		state.previewProductIndex = 0;
	}

	function renderPreviewResults() {
		const $tabs = $('#aisales-preview-tabs');
		const $content = $('#aisales-preview-content');
		$tabs.empty();
		$content.empty();

		state.previewResults.forEach(function(result, index) {
			// Create tab
			const $tab = $(`
				<button type="button" class="aisales-preview-tab ${index === 0 ? 'aisales-preview-tab--active' : ''}" data-index="${index}">
					${escapeHtml(result.product_name)}
				</button>
			`);
			$tab.on('click', function() {
				switchPreviewTab(index);
			});
			$tabs.append($tab);

			// Create content
			const product = getProductById(result.product_id);
			const $productContent = $(`
				<div class="aisales-preview-product ${index === 0 ? 'aisales-preview-product--active' : ''}" data-index="${index}">
					<div class="aisales-preview-product__header">
						<img src="${product ? product.image_url || '' : ''}" alt="" class="aisales-preview-product__image">
						<div class="aisales-preview-product__info">
							<h4>${escapeHtml(result.product_name)}</h4>
							<span>ID: ${result.product_id}</span>
						</div>
					</div>
					<div class="aisales-diff-fields">
						${renderDiffFields(result.suggestions, product)}
					</div>
				</div>
			`);
			$content.append($productContent);
		});

		state.previewProductIndex = 0;
	}

	function renderDiffFields(suggestions, product) {
		if (!suggestions) return '<p>No suggestions generated.</p>';

		const htmlFields = ['description', 'short_description'];
		let html = '';

		Object.keys(suggestions).forEach(function(field) {
			const suggestion = suggestions[field];
			if (!suggestion) return;

			const label = ENHANCEMENT_LABELS[field] || field;
			const isHtmlField = htmlFields.includes(field);
			const isArrayField = field === 'tags' || field === 'categories';
			
			let currentDisplay, suggestedDisplay;

			if (isArrayField) {
				currentDisplay = escapeHtml((suggestion.current || []).join(', ') || '(none)');
				suggestedDisplay = escapeHtml((suggestion.suggested || []).join(', ') || '(none)');
			} else if (isHtmlField) {
				const current = suggestion.current || '';
				const suggested = suggestion.suggested || '';
				currentDisplay = current ? current : '<em>(empty)</em>';
				suggestedDisplay = suggested ? sanitizeHtml(suggested) : '<em>(no change)</em>';
			} else {
				currentDisplay = escapeHtml(suggestion.current || '(empty)');
				suggestedDisplay = escapeHtml(suggestion.suggested || '(no change)');
			}

			html += `
				<div class="aisales-diff-field ${isHtmlField ? 'aisales-diff-field--html' : ''}" data-field="${field}">
					<div class="aisales-diff-field__header">
						<span class="aisales-diff-field__label">${escapeHtml(label)}</span>
					</div>
					<div class="aisales-diff-field__content">
						<div class="aisales-diff-field__current">
							<span class="aisales-diff-field__subtitle">Current</span>
							<div class="aisales-diff-field__value">${currentDisplay}</div>
						</div>
						<div class="aisales-diff-field__arrow">
							<span class="dashicons dashicons-arrow-right-alt"></span>
						</div>
						<div class="aisales-diff-field__suggested">
							<span class="aisales-diff-field__subtitle">Suggested</span>
							<div class="aisales-diff-field__value">${suggestedDisplay}</div>
						</div>
					</div>
				</div>
			`;
		});

		return html || '<p>No changes suggested.</p>';
	}

	function switchPreviewTab(index) {
		state.previewProductIndex = index;

		$('.aisales-preview-tab').removeClass('aisales-preview-tab--active');
		$('.aisales-preview-tab[data-index="' + index + '"]').addClass('aisales-preview-tab--active');

		$('.aisales-preview-product').removeClass('aisales-preview-product--active');
		$('.aisales-preview-product[data-index="' + index + '"]').addClass('aisales-preview-product--active');
	}

	function toggleRefinementPanel() {
		const $panel = $('#aisales-refinement-panel');
		const $content = $panel.find('.aisales-collapsible-content');

		$panel.toggleClass('aisales-card--expanded');
		$content.slideToggle(200);
	}

	async function regeneratePreview() {
		// Collect refinement options
		const refinementOptions = {
			length_structure: [],
			tone_style: [],
			content_focus: [],
			seo_specific: [],
			tags_categories: [],
		};

		$('input[name^="refinement["]:checked').each(function() {
			const name = $(this).attr('name');
			const match = name.match(/refinement\[(\w+)\]/);
			if (match && refinementOptions[match[1]]) {
				refinementOptions[match[1]].push($(this).val());
			}
		});

		const additionalComments = $('#aisales-refinement-comments').val();

		// Get preview products
		const selectedProducts = getSelectedProducts().slice(0, config.previewSize);
		const previewCount = selectedProducts.length;

		// Show loading
		$('#aisales-preview-results').hide();
		$('#aisales-step3-actions').hide();
		$('#aisales-preview-loading').show();
		$('#aisales-preview-status').text(`Applying refinements to ${previewCount} product${previewCount !== 1 ? 's' : ''}...`);
		$('#aisales-preview-progress').css('width', '0%');
		
		// Clear previous results for progressive rendering
		$('#aisales-preview-tabs').empty();
		$('#aisales-preview-content').empty();
		state.previewResults = [];

		try {
			let receivedProducts = 0;
			const totalProducts = selectedProducts.length;

			const result = await apiRequestSSE(
				`/ai/batch/jobs/${state.jobId}/refine`,
				{
					selected_options: refinementOptions,
					additional_comments: additionalComments,
					attachment_ids: state.uploadedAttachments.map(a => a.id),
					products: selectedProducts.map(formatProductForApi),
				},
				{
					onStart: function(data) {
						$('#aisales-preview-status').text(data.message || 'Starting...');
						$('#aisales-preview-progress').css('width', '15%');
					},
					onProcessing: function(data) {
						$('#aisales-preview-status').text(data.message || 'AI is regenerating...');
						$('#aisales-preview-progress').css('width', '30%');
					},
					onProductResult: function(data) {
						// Add product result progressively
						state.previewResults.push(data);
						receivedProducts++;
						
						// Update progress
						const progress = 30 + (receivedProducts / totalProducts) * 60;
						$('#aisales-preview-progress').css('width', progress + '%');
						$('#aisales-preview-status').text(`Refined: ${data.product_name}`);
						
						// Progressively render results
						addPreviewResult(data, receivedProducts - 1);
					},
					onBalanceUpdate: function(data) {
						state.balance = data.new_balance;
						updateBalanceDisplay();
					},
					onDone: function(data) {
						$('#aisales-preview-progress').css('width', '100%');
						$('#aisales-preview-status').text('Complete!');
					},
					onError: function(data) {
						throw new Error(data.message || 'Refinement failed');
					}
				}
			);

			// Finalize UI
			setTimeout(function() {
				$('#aisales-preview-loading').hide();
				$('#aisales-preview-results').show();
				$('#aisales-step3-actions').show();
				renderPreviewResults();

				// Close refinement panel
				$('#aisales-refinement-panel').removeClass('aisales-card--expanded');
				$('#aisales-refinement-panel .aisales-collapsible-content').slideUp(200);

				showNotice(config.i18n.success || 'Success', 'Preview regenerated with your feedback.', 'success');
			}, 300);

		} catch (error) {
			$('#aisales-preview-loading').hide();
			$('#aisales-preview-results').show();
			$('#aisales-step3-actions').show();
			showNotice(config.i18n.error || 'Error', error.message, 'error');
		}
	}

	// ==========================================================================
	// FILE UPLOAD
	// ==========================================================================

	function setupDragDrop() {
		const $dropzone = $('#aisales-dropzone');

		$dropzone.on('dragover', function(e) {
			e.preventDefault();
			$(this).addClass('dragging');
		});

		$dropzone.on('dragleave', function(e) {
			e.preventDefault();
			$(this).removeClass('dragging');
		});

		$dropzone.on('drop', function(e) {
			e.preventDefault();
			$(this).removeClass('dragging');

			const files = e.originalEvent.dataTransfer.files;
			handleFiles(files);
		});
	}

	function handleFileSelect(e) {
		const files = e.target.files;
		handleFiles(files);
	}

	async function handleFiles(files) {
		for (let i = 0; i < files.length; i++) {
			const file = files[i];

			// Validate file
			const allowedTypes = ['application/pdf', 'image/png', 'image/jpeg', 'image/webp', 'text/plain', 'text/markdown'];
			if (!allowedTypes.includes(file.type)) {
				showNotice(config.i18n.error || 'Error', `Invalid file type: ${file.name}`, 'error');
				continue;
			}

			if (file.size > 10 * 1024 * 1024) {
				showNotice(config.i18n.error || 'Error', `File too large: ${file.name}`, 'error');
				continue;
			}

			// Upload file
			try {
				const formData = new FormData();
				formData.append('file', file);

				const response = await fetch(`${config.apiBaseUrl}/ai/batch/jobs/${state.jobId}/attachments`, {
					method: 'POST',
					headers: {
						'X-API-Key': config.apiKey,
					},
					body: formData,
				});

				const data = await response.json();

				if (!data.error && data.attachment) {
					state.uploadedAttachments.push(data.attachment);
					renderFileList();
				} else {
					throw new Error(data.message || data.error || 'Upload failed');
				}
			} catch (error) {
				showNotice(config.i18n.error || 'Error', `Failed to upload ${file.name}: ${error.message}`, 'error');
			}
		}
	}

	function renderFileList() {
		const $list = $('#aisales-file-list');
		$list.empty();

		state.uploadedAttachments.forEach(function(attachment, index) {
			const $item = $(`
				<div class="aisales-file-item" data-index="${index}">
					<span>${escapeHtml(attachment.filename)}</span>
					<button type="button" class="aisales-file-item__remove" data-index="${index}">
						<span class="dashicons dashicons-no-alt"></span>
					</button>
				</div>
			`);

			$item.find('.aisales-file-item__remove').on('click', function() {
				state.uploadedAttachments.splice(index, 1);
				renderFileList();
			});

			$list.append($item);
		});
	}

	// ==========================================================================
	// STEP 4: PROCESSING
	// ==========================================================================

	async function approveAndProcess() {
		try {
			// Approve the job
			const approveResponse = await apiRequest('POST', `/ai/batch/jobs/${state.jobId}/approve`);

			if (approveResponse.error) {
				throw new Error(approveResponse.message || approveResponse.error || 'Failed to approve job');
			}

			// Move to step 4
			setStep(4);
			state.isProcessing = true;
			state.isPaused = false;

			// Reset counters
			state.processedItems = 0;
			state.successfulItems = 0;
			state.failedItems = 0;
			state.tokensUsed = 0;
			state.results = [];

			// Clear log
			$('#aisales-process-log').empty();

			// Start processing
			await processAllProducts();

		} catch (error) {
			showNotice(config.i18n.error || 'Error', error.message, 'error');
		}
	}

	async function processAllProducts() {
		const allProductIds = Array.from(state.selectedProductIds);
		const totalProducts = allProductIds.length;

		// Process in batches
		for (let i = 0; i < totalProducts; i += config.batchSize) {
			// Check if paused or cancelled
			if (state.isPaused || !state.isProcessing) {
				break;
			}

			const batchIds = allProductIds.slice(i, i + config.batchSize);

			if (batchIds.length === 0) continue;

			// Get the first product name for display
			const firstProduct = getProductById(batchIds[0]);
			const currentName = firstProduct?.title || 'Product';
			$('#aisales-current-product').text(`Processing: ${currentName}...`);

			try {
				// Send only product_ids - the API uses approved preview results
				const response = await apiRequest('POST', `/ai/batch/jobs/${state.jobId}/process`, {
					product_ids: batchIds.map(String),
				});

				if (response.error) {
					throw new Error(response.message || response.error || 'Batch processing failed');
				}

				// Update counters
				const batchResults = response.batch_results || [];
				batchResults.forEach(function(result) {
					state.results.push(result);
					state.processedItems++;

					if (result.status === 'completed') {
						state.successfulItems++;
						addLogEntry(`${result.product_name}`, 'success');
					} else {
						state.failedItems++;
						addLogEntry(`${result.product_name}: ${result.error || 'Failed'}`, 'error');
					}
				});

				state.tokensUsed += response.tokens_used?.total || 0;
				if (response.new_balance !== undefined) {
					state.balance = response.new_balance;
				}

				// Update UI
				updateProcessingUI(totalProducts);

				// Small delay between batches (reduced since no AI calls)
				await sleep(100);

			} catch (error) {
				// Log error but continue
				addLogEntry(`Batch error: ${error.message}`, 'error');
				state.failedItems += batchIds.length;
				state.processedItems += batchIds.length;
				updateProcessingUI(totalProducts);
			}
		}

		// Processing complete
		if (state.isProcessing && !state.isPaused) {
			completeProcessing();
		}
	}

	function updateProcessingUI(totalProducts) {
		const percent = Math.round((state.processedItems / totalProducts) * 100);

		$('#aisales-processed-count').text(state.processedItems);
		$('#aisales-success-count').text(state.successfulItems);
		$('#aisales-failed-count').text(state.failedItems);
		$('#aisales-tokens-count').text(numberFormat(state.tokensUsed));
		$('#aisales-progress-percent').text(percent);
		$('#aisales-process-progress').css('width', percent + '%');

		updateBalanceDisplay();
	}

	function addLogEntry(message, type) {
		const time = new Date().toLocaleTimeString();
		const $entry = $(`
			<div class="aisales-process-log__entry aisales-process-log__entry--${type || ''}">
				<span class="aisales-process-log__time">[${time}]</span>
				<span>${escapeHtml(message)}</span>
			</div>
		`);

		$('#aisales-process-log').append($entry);
		$('#aisales-process-log').scrollTop($('#aisales-process-log')[0].scrollHeight);
	}

	function pauseProcessing() {
		state.isPaused = true;
		$('#aisales-pause-process').hide();
		$('#aisales-resume-process').show();
		$('#aisales-process-status').text(config.i18n.pause || 'Paused').removeClass('aisales-badge--primary').addClass('aisales-badge--warning');
		$('#aisales-current-product').text('Paused');

		// Call pause API
		apiRequest('POST', `/ai/batch/jobs/${state.jobId}/pause`);
	}

	function resumeProcessing() {
		state.isPaused = false;
		$('#aisales-resume-process').hide();
		$('#aisales-pause-process').show();
		$('#aisales-process-status').text(config.i18n.processing || 'Running').removeClass('aisales-badge--warning').addClass('aisales-badge--primary');

		// Call resume API
		apiRequest('POST', `/ai/batch/jobs/${state.jobId}/resume`);

		// Continue processing
		processAllProducts();
	}

	async function cancelProcessing() {
		if (!confirm('Are you sure you want to cancel? Progress will be lost.')) {
			return;
		}

		state.isProcessing = false;
		state.isPaused = false;

		// Call cancel API
		await apiRequest('POST', `/ai/batch/jobs/${state.jobId}/cancel`);

		// Go back to step 1
		resetState();
		setStep(1);
	}

	function completeProcessing() {
		state.isProcessing = false;
		$('#aisales-process-status').text(config.i18n.complete || 'Complete').removeClass('aisales-badge--primary').addClass('aisales-badge--success');
		$('#aisales-current-product').text('All products processed');

		addLogEntry('Processing complete!', 'success');

		// Move to step 5 after a short delay
		setTimeout(function() {
			setStep(5);
			renderResults();
		}, 1500);
	}

	// ==========================================================================
	// STEP 5: RESULTS
	// ==========================================================================

	function renderResults() {
		const $tbody = $('#aisales-results-body');
		$tbody.empty();

		state.selectedResultIds.clear();

		// Update summary
		$('#aisales-final-success').text(state.successfulItems);
		$('#aisales-final-tokens').text(numberFormat(state.tokensUsed));

		// Show/hide failed summary and retry button
		if (state.failedItems > 0) {
			$('#aisales-final-failed').text(state.failedItems);
			$('#aisales-failed-summary').show();
		} else {
			$('#aisales-failed-summary').hide();
		}

		state.results.forEach(function(result) {
			if (result.status !== 'completed') return;

			state.selectedResultIds.add(result.product_id);
			const product = getProductById(result.product_id);
			const imageUrl = product ? product.image_url || '' : '';
			const editUrl = product ? product.edit_url || '#' : '#';
			const viewUrl = product ? product.view_url || '#' : '#';

			// Get change badges
			const changes = [];
			if (result.suggestions) {
				Object.keys(result.suggestions).forEach(function(field) {
					changes.push(`<span class="aisales-results-table__change-badge">${ENHANCEMENT_LABELS[field] || field}</span>`);
				});
			}

			const $row = $(`
				<tr data-product-id="${result.product_id}">
					<td class="aisales-results-table__check">
						<input type="checkbox" class="aisales-result-checkbox" value="${result.product_id}" checked>
					</td>
					<td>
						<div class="aisales-results-table__product">
							<img src="${imageUrl}" alt="" class="aisales-results-table__product-image">
							<span class="aisales-results-table__product-name">${escapeHtml(result.product_name)}</span>
						</div>
					</td>
					<td>
						<div class="aisales-results-table__changes">
							${changes.join('')}
						</div>
					</td>
					<td>
						<span class="aisales-results-table__status aisales-results-table__status--pending">Pending</span>
					</td>
					<td>
						<div class="aisales-results-table__actions">
							<button type="button" class="aisales-btn aisales-btn--secondary aisales-btn--sm aisales-view-details" data-product-id="${result.product_id}" title="View Changes">
								<span class="dashicons dashicons-visibility"></span>
							</button>
							<a href="${escapeHtml(viewUrl)}" target="_blank" rel="noopener noreferrer" class="aisales-btn aisales-btn--secondary aisales-btn--sm" title="View Product Page">
								<span class="dashicons dashicons-external"></span>
							</a>
							<a href="${escapeHtml(editUrl)}" target="_blank" rel="noopener noreferrer" class="aisales-btn aisales-btn--secondary aisales-btn--sm" title="Edit Product">
								<span class="dashicons dashicons-edit"></span>
							</a>
						</div>
					</td>
				</tr>
			`);

			$tbody.append($row);
		});

		updateApplyCount();
	}

	function toggleAllResults() {
		const isChecked = $('#aisales-select-all-results').is(':checked');

		$('.aisales-result-checkbox').prop('checked', isChecked);

		state.selectedResultIds.clear();
		if (isChecked) {
			state.results.forEach(function(result) {
				if (result.status === 'completed') {
					state.selectedResultIds.add(result.product_id);
				}
			});
		}

		updateApplyCount();
	}

	function updateApplyCount() {
		state.selectedResultIds.clear();
		$('.aisales-result-checkbox:checked').each(function() {
			state.selectedResultIds.add($(this).val());
		});

		$('#aisales-apply-count').text(state.selectedResultIds.size);
	}

	function viewResultDetails(e) {
		e.preventDefault();
		e.stopPropagation();
		
		const $btn = $(e.target).closest('.aisales-view-details');
		const productId = $btn.data('product-id');
		
		if (!productId) return;
		
		const productIdStr = String(productId);
		const result = state.results.find(r => String(r.product_id) === productIdStr);
		const product = getProductById(productIdStr);

		if (!result || !result.suggestions) {
			showNotice(config.i18n.error || 'Error', 'No details available for this product.', 'error');
			return;
		}

		// Build modal content and update UI
		$('#aisales-result-modal-title').text(result.product_name);
		$('#aisales-result-modal-body').html(renderDiffFields(result.suggestions, product));
		$('#aisales-result-modal-edit').attr('href', product?.edit_url || '#');
		$('#aisales-result-modal-view').attr('href', product?.view_url || '#');
		
		// Show modal
		$('#aisales-result-modal-overlay').addClass('aisales-modal-overlay--active');
		$('#aisales-result-modal').addClass('aisales-modal--active');
		$('body').addClass('aisales-modal-open');
	}
	
	function closeResultModal() {
		$('#aisales-result-modal-overlay').removeClass('aisales-modal-overlay--active');
		$('#aisales-result-modal').removeClass('aisales-modal--active');
		$('body').removeClass('aisales-modal-open');
	}

	async function applyResults() {
		if (state.selectedResultIds.size === 0) {
			showNotice(config.i18n.error || 'Error', 'Please select at least one product to apply.', 'error');
			return;
		}

		const $btn = $('#aisales-apply-results');
		$btn.prop('disabled', true).text('Applying...');

		let applied = 0;
		let failed = 0;

		for (const productId of state.selectedResultIds) {
			const result = state.results.find(r => r.product_id === productId);
			if (!result || !result.suggestions) continue;

			try {
				// Call WordPress AJAX to apply changes
				const response = await $.ajax({
					url: config.ajaxUrl,
					method: 'POST',
					data: {
						action: 'aisales_apply_batch_result',
						nonce: config.nonce,
						product_id: productId,
						suggestions: JSON.stringify(result.suggestions),
					},
				});

				if (response.success) {
					applied++;
					$(`tr[data-product-id="${productId}"] .aisales-results-table__status`)
						.removeClass('aisales-results-table__status--pending')
						.addClass('aisales-results-table__status--applied')
						.text('Applied');
				} else {
					throw new Error(response.data || 'Failed');
				}
			} catch (error) {
				failed++;
				$(`tr[data-product-id="${productId}"] .aisales-results-table__status`)
					.removeClass('aisales-results-table__status--pending')
					.addClass('aisales-results-table__status--failed')
					.text('Failed');
			}
		}

		$btn.prop('disabled', false).html('<span class="dashicons dashicons-yes"></span> Apply Selected Changes');

		if (applied > 0) {
			showNotice(config.i18n.success || 'Success', `Applied changes to ${applied} product(s).`, 'success');
		}
		if (failed > 0) {
			showNotice(config.i18n.error || 'Error', `Failed to apply to ${failed} product(s).`, 'error');
		}
	}

	/**
	 * Retry failed items from the batch job
	 */
	async function retryFailedItems() {
		// Get failed items from current results
		const failedItems = state.results.filter(function(r) {
			return r.status === 'failed';
		});

		if (failedItems.length === 0) {
			showNotice(config.i18n.info || 'Info', 'No failed items to retry.', 'info');
			return;
		}

		// Confirm retry
		if (!confirm(`Retry ${failedItems.length} failed product(s)? This will use additional tokens.`)) {
			return;
		}

		const $btn = $('#aisales-retry-failed');
		$btn.prop('disabled', true).text('Retrying...');

		try {
			// Get product data for failed items
			const failedProductIds = failedItems.map(function(item) { return item.product_id; });
			const failedProducts = failedProductIds.map(function(id) {
				return formatProductForApi(getProductById(id));
			}).filter(Boolean);

			if (failedProducts.length === 0) {
				throw new Error('Could not find product data for failed items');
			}

			// Call retry API
			const response = await apiRequest('POST', `/ai/batch/jobs/${state.jobId}/retry-failed`, {
				products: failedProducts,
			});

			if (response.error) {
				throw new Error(response.message || response.error || 'Retry failed');
			}

			// Update state with new results
			const retryResults = response.retry_results || [];
			
			// Remove old failed results and add new results
			state.results = state.results.filter(function(r) {
				return !failedProductIds.includes(r.product_id);
			});
			state.results = state.results.concat(retryResults);

			// Update counters
			state.successfulItems = state.results.filter(function(r) { return r.status === 'completed'; }).length;
			state.failedItems = state.results.filter(function(r) { return r.status === 'failed'; }).length;
			state.tokensUsed += response.tokens_used?.total || 0;
			state.balance = response.new_balance || state.balance;

			// Re-render results
			renderResults();
			updateBalanceDisplay();

			// Show success message
			const newlySucceeded = response.newly_succeeded || 0;
			const stillFailed = response.still_failed || 0;

			if (newlySucceeded > 0) {
				showNotice(
					config.i18n.success || 'Success',
					`Retry complete: ${newlySucceeded} product(s) succeeded.${stillFailed > 0 ? ` ${stillFailed} still failed.` : ''}`,
					'success'
				);
			} else if (stillFailed > 0) {
				showNotice(
					config.i18n.warning || 'Warning',
					`Retry complete but all ${stillFailed} product(s) still failed.`,
					'warning'
				);
			}

		} catch (error) {
			showNotice(config.i18n.error || 'Error', error.message, 'error');
		} finally {
			$btn.prop('disabled', false).html('<span class="dashicons dashicons-update"></span> Retry Failed');
		}
	}

	// ==========================================================================
	// MISC ACTIONS
	// ==========================================================================

	async function cancelBatch() {
		if (!confirm('Are you sure you want to cancel this batch job?')) {
			return;
		}

		if (state.jobId) {
			await apiRequest('POST', `/ai/batch/jobs/${state.jobId}/cancel`);
		}

		resetState();
		setStep(1);
	}

	function startNewBatch() {
		resetState();
		setStep(1);
		showNotice(config.i18n.success || 'Success', 'Ready to start a new batch.', 'success');
	}

	function resetState() {
		state.jobId = null;
		state.jobStatus = null;
		state.previewResults = [];
		state.previewProductIndex = 0;
		state.isProcessing = false;
		state.isPaused = false;
		state.processedItems = 0;
		state.successfulItems = 0;
		state.failedItems = 0;
		state.tokensUsed = 0;
		state.results = [];
		state.selectedResultIds.clear();
		state.uploadedAttachments = [];

		// Clear refinement form
		$('input[name^="refinement["]:checked').prop('checked', false);
		$('#aisales-refinement-comments').val('');
		$('#aisales-file-list').empty();
	}

	// ==========================================================================
	// API HELPER
	// ==========================================================================

	async function apiRequest(method, endpoint, data) {
		const url = config.apiBaseUrl + endpoint;

		const options = {
			method: method,
			headers: {
				'Content-Type': 'application/json',
				'X-API-Key': config.apiKey,
			},
		};

		if (data && (method === 'POST' || method === 'PUT' || method === 'PATCH')) {
			options.body = JSON.stringify(data);
		}

		try {
			const response = await fetch(url, options);
			const json = await response.json();
			return json;
		} catch (error) {
			return {
				success: false,
				error: error.message,
			};
		}
	}

	/**
	 * Make an SSE (Server-Sent Events) request for streaming responses
	 * @param {string} endpoint - API endpoint
	 * @param {object} data - Request body
	 * @param {object} callbacks - Event callbacks { onStart, onProcessing, onProductResult, onBalanceUpdate, onDone, onError }
	 * @returns {Promise<object>} - Final result from 'done' event
	 */
	async function apiRequestSSE(endpoint, data, callbacks) {
		const url = config.apiBaseUrl + endpoint;

		return new Promise((resolve, reject) => {
			// Use fetch with SSE
			fetch(url, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'Accept': 'text/event-stream',
					'X-API-Key': config.apiKey,
				},
				body: JSON.stringify(data),
			}).then(response => {
				if (!response.ok) {
					return response.json().then(err => {
						reject(new Error(err.message || err.error || 'Request failed'));
					});
				}

				const reader = response.body.getReader();
				const decoder = new TextDecoder();
				let buffer = '';

				function processEvents() {
					reader.read().then(({ done, value }) => {
						if (done) {
							return;
						}

						buffer += decoder.decode(value, { stream: true });
						const lines = buffer.split('\n');
						buffer = lines.pop() || ''; // Keep incomplete line in buffer

						let currentEvent = '';
						let currentData = '';

						for (const line of lines) {
							if (line.startsWith('event: ')) {
								currentEvent = line.slice(7).trim();
							} else if (line.startsWith('data: ')) {
								currentData = line.slice(6);
							} else if (line === '' && currentEvent && currentData) {
								// End of event, process it
								try {
									const eventData = JSON.parse(currentData);
									handleSSEEvent(currentEvent, eventData, callbacks, resolve, reject);
								} catch (e) {
									console.error('Failed to parse SSE event data:', e);
								}
								currentEvent = '';
								currentData = '';
							}
						}

						processEvents();
					}).catch(error => {
						reject(error);
					});
				}

				processEvents();
			}).catch(error => {
				reject(error);
			});
		});
	}

	function handleSSEEvent(event, data, callbacks, resolve, reject) {
		switch (event) {
			case 'start':
				if (callbacks.onStart) callbacks.onStart(data);
				break;
			case 'processing':
				if (callbacks.onProcessing) callbacks.onProcessing(data);
				break;
			case 'product_result':
				if (callbacks.onProductResult) callbacks.onProductResult(data);
				break;
			case 'balance_update':
				if (callbacks.onBalanceUpdate) callbacks.onBalanceUpdate(data);
				break;
			case 'done':
				if (callbacks.onDone) callbacks.onDone(data);
				resolve(data);
				break;
			case 'error':
				if (callbacks.onError) callbacks.onError(data);
				reject(new Error(data.message || 'SSE error'));
				break;
			default:
				console.log('Unknown SSE event:', event, data);
		}
	}

	// ==========================================================================
	// UTILITIES
	// ==========================================================================

	function getSelectedProducts() {
		return state.products.filter(function(p) {
			return state.selectedProductIds.has(p.id);
		});
	}

	function getProductById(id) {
		return state.products.find(function(p) {
			return p.id === id || p.id === String(id);
		});
	}

	function formatProductForApi(product) {
		if (!product) return null;
		return {
			id: product.id,
			title: product.title,
			description: product.description || '',
			short_description: product.short_description || '',
			price: product.price || '',
			categories: product.categories || [],
			tags: product.tags || [],
		};
	}

	function updateBalanceDisplay() {
		$('#aisales-balance-display').text(numberFormat(state.balance));
		$('#aisales-estimate-balance').text(numberFormat(state.balance));
	}

	function showNotice(title, message, type) {
		// Use WordPress admin notices
		const $notice = $(`
			<div class="notice notice-${type === 'error' ? 'error' : type === 'success' ? 'success' : 'info'} is-dismissible">
				<p><strong>${escapeHtml(title)}:</strong> ${escapeHtml(message)}</p>
				<button type="button" class="notice-dismiss">
					<span class="screen-reader-text">Dismiss this notice.</span>
				</button>
			</div>
		`);

		$notice.find('.notice-dismiss').on('click', function() {
			$notice.fadeOut(200, function() {
				$(this).remove();
			});
		});

		$('.aisales-batch-wrap .aisales-notices-anchor').after($notice);

		// Auto dismiss after 5 seconds
		setTimeout(function() {
			$notice.fadeOut(200, function() {
				$(this).remove();
			});
		}, 5000);
	}

	function escapeHtml(text) {
		if (!text) return '';
		const div = document.createElement('div');
		div.textContent = text;
		return div.innerHTML;
	}

	/**
	 * Sanitize HTML content, allowing only safe formatting tags
	 * Used for rendering AI-generated descriptions in preview
	 */
	function sanitizeHtml(html) {
		if (!html) return '';
		
		// Create a temporary element
		const temp = document.createElement('div');
		temp.innerHTML = html;
		
		// Allowed tags for product descriptions
		const allowedTags = ['P', 'BR', 'STRONG', 'B', 'EM', 'I', 'U', 'UL', 'OL', 'LI', 'H3', 'H4', 'H5', 'H6', 'SPAN', 'DIV', 'A'];
		const allowedAttributes = ['href', 'target', 'rel', 'class'];
		
		function sanitizeNode(node) {
			// Process child nodes in reverse (since we may remove some)
			const children = Array.from(node.childNodes);
			children.forEach(function(child) {
				if (child.nodeType === Node.ELEMENT_NODE) {
					if (!allowedTags.includes(child.tagName)) {
						// Replace disallowed tag with its content
						while (child.firstChild) {
							node.insertBefore(child.firstChild, child);
						}
						node.removeChild(child);
					} else {
						// Remove disallowed attributes
						Array.from(child.attributes).forEach(function(attr) {
							if (!allowedAttributes.includes(attr.name)) {
								child.removeAttribute(attr.name);
							}
						});
						// For links, ensure they open safely
						if (child.tagName === 'A') {
							child.setAttribute('target', '_blank');
							child.setAttribute('rel', 'noopener noreferrer');
						}
						// Recursively sanitize children
						sanitizeNode(child);
					}
				}
			});
		}
		
		sanitizeNode(temp);
		return temp.innerHTML;
	}

	function numberFormat(num) {
		return new Intl.NumberFormat().format(num);
	}

	function debounce(func, wait) {
		let timeout;
		return function executedFunction() {
			const context = this;
			const args = arguments;
			clearTimeout(timeout);
			timeout = setTimeout(function() {
				func.apply(context, args);
			}, wait);
		};
	}

	function sleep(ms) {
		return new Promise(resolve => setTimeout(resolve, ms));
	}

	// ==========================================================================
	// INIT ON DOM READY
	// ==========================================================================

	$(document).ready(init);

})(jQuery);
