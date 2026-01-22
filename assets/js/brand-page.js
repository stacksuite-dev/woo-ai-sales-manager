/**
 * Brand Settings Page JavaScript
 *
 * Handles the brand settings page functionality including:
 * - Empty state / AI analyze flow
 * - Form interactions and validation
 * - Custom color picker
 * - Live preview updates
 * - AJAX save operations
 *
 * @package AISales_Sales_Manager
 */

(function ($) {
	'use strict';

	// Page state
	const pageState = {
		currentView: 'empty', // 'empty', 'analyzing', 'review', 'form'
		isLoading: false,
		isDirty: false,
		suggestions: null,
	};

	// Color picker instances
	const colorPickers = {};

	// Preset colors for quick selection
	const presetColors = [
		'#7f54b3', '#6366f1', '#3b82f6', '#0ea5e9', '#14b8a6',
		'#22c55e', '#84cc16', '#eab308', '#f97316', '#ef4444',
		'#ec4899', '#8b5cf6', '#1f2937', '#4b5563', '#9ca3af',
	];

	// Cache DOM elements
	let $emptyState, $analyzingState, $reviewState, $formState;
	let $form, $saveBtn, $analyzeBtn;

	/**
	 * Initialize the page
	 */
	function init() {
		cacheElements();
		bindEvents();
		initCustomColorPickers();
		initToneSelection();
		updatePreview();

		// Determine initial view
		if (typeof aisalesBrand !== 'undefined' && aisalesBrand.hasSetup) {
			pageState.currentView = 'form';
		}
	}

	/**
	 * Cache DOM elements
	 */
	function cacheElements() {
		$emptyState = $('#aisales-brand-empty-state');
		$analyzingState = $('#aisales-brand-analyzing-state');
		$reviewState = $('#aisales-brand-review-state');
		$formState = $('#aisales-brand-form-state');
		$form = $('#aisales-brand-form');
		$saveBtn = $('#aisales-brand-save-btn');
		$analyzeBtn = $('#aisales-brand-analyze-btn');
	}

	/**
	 * Bind event handlers
	 */
	function bindEvents() {
		// Empty state actions
		$(document).on('click', '#aisales-brand-analyze-btn, #aisales-brand-reanalyze-btn', startAnalysis);
		$(document).on('click', '#aisales-brand-manual-btn', showFormView);

		// Review state actions
		$(document).on('click', '#aisales-brand-continue-btn', continueToSettings);

		// Form interactions
		$form.on('submit', handleFormSubmit);
		$(document).on('click', '#aisales-reset-colors-btn', resetColors);

		// Track form changes
		$form.on('input change', 'input, select, textarea', function () {
			pageState.isDirty = true;
		});

		// Tone and promotion style selection
		$(document).on('change', 'input[name="brand_tone"]', handleToneChange);
		$(document).on('change', 'input[name="promotion_style"]', handlePromotionStyleChange);

		// Live preview updates
		$(document).on('input change', '#aisales-store-name', updatePreviewStoreName);

		// Warn before leaving with unsaved changes
		$(window).on('beforeunload', function () {
			if (pageState.isDirty) {
				return 'You have unsaved changes. Are you sure you want to leave?';
			}
		});
	}

	/* ==========================================================================
	   Custom Color Picker
	   ========================================================================== */

	/**
	 * Initialize custom color pickers
	 */
	function initCustomColorPickers() {
		$('.aisales-color-picker').each(function () {
			const $input = $(this);
			const inputId = $input.attr('id');
			const defaultColor = $input.data('default-color') || '#7f54b3';
			const currentValue = $input.val() || defaultColor;

			// Create color picker instance
			colorPickers[inputId] = {
				$input: $input,
				defaultColor: defaultColor,
				currentColor: currentValue,
				hue: 0,
				saturation: 100,
				brightness: 100,
				isOpen: false,
			};

			// Build the UI
			buildColorPickerUI($input, inputId, currentValue);

			// Parse initial color
			const hsb = hexToHsb(currentValue);
			colorPickers[inputId].hue = hsb.h;
			colorPickers[inputId].saturation = hsb.s;
			colorPickers[inputId].brightness = hsb.b;
		});
	}

	/**
	 * Build color picker UI elements
	 */
	function buildColorPickerUI($input, inputId, currentValue) {
		// Hide original input
		$input.hide();

		// Create wrapper
		const $wrapper = $('<div class="aisales-color-field"></div>');

		// Create trigger button
		const $trigger = $(`
			<button type="button" class="aisales-color-trigger" data-picker-id="${inputId}">
				<span class="aisales-color-trigger__swatch">
					<span class="aisales-color-trigger__swatch-color" style="background-color: ${currentValue}"></span>
				</span>
				<span class="aisales-color-trigger__value">${currentValue}</span>
				<span class="aisales-color-trigger__icon">
					<span class="dashicons dashicons-arrow-down-alt2"></span>
				</span>
			</button>
		`);

		// Create popover
		const $popover = $(`
			<div class="aisales-color-popover" data-picker-id="${inputId}">
				<div class="aisales-color-popover__content">
					<div class="aisales-color-picker__saturation" data-picker-id="${inputId}">
						<div class="aisales-color-picker__saturation-gradient"></div>
						<div class="aisales-color-picker__saturation-cursor"></div>
					</div>
					<div class="aisales-color-picker__hue" data-picker-id="${inputId}">
						<div class="aisales-color-picker__hue-cursor"></div>
					</div>
					<div class="aisales-color-picker__input-row">
						<span class="aisales-color-picker__input-label">Hex</span>
						<input type="text" class="aisales-color-picker__hex-input" data-picker-id="${inputId}" value="${currentValue}" maxlength="7">
					</div>
					<div class="aisales-color-picker__presets" data-picker-id="${inputId}">
						${presetColors.map(color => `
							<button type="button" class="aisales-color-picker__preset ${color === currentValue ? 'aisales-color-picker__preset--active' : ''}" 
								data-color="${color}" style="background-color: ${color}"></button>
						`).join('')}
					</div>
				</div>
			</div>
		`);

		// Assemble
		$wrapper.append($trigger).append($popover);
		$input.after($wrapper);

		// Bind events for this picker
		bindColorPickerEvents(inputId, $trigger, $popover);

		// Update saturation area color
		updateSaturationBackground(inputId);
		updateCursorPositions(inputId);
	}

	/**
	 * Bind events for a color picker instance
	 */
	function bindColorPickerEvents(inputId, $trigger, $popover) {
		const picker = colorPickers[inputId];

		// Toggle popover
		$trigger.on('click', function (e) {
			e.preventDefault();
			e.stopPropagation();
			toggleColorPicker(inputId);
		});

		// Saturation area interaction
		const $saturation = $popover.find('.aisales-color-picker__saturation');
		$saturation.on('mousedown', function (e) {
			e.preventDefault();
			handleSaturationChange(inputId, e);

			$(document).on('mousemove.colorpicker', function (e) {
				handleSaturationChange(inputId, e);
			});

			$(document).on('mouseup.colorpicker', function () {
				$(document).off('.colorpicker');
			});
		});

		// Hue slider interaction
		const $hue = $popover.find('.aisales-color-picker__hue');
		$hue.on('mousedown', function (e) {
			e.preventDefault();
			handleHueChange(inputId, e);

			$(document).on('mousemove.colorpicker', function (e) {
				handleHueChange(inputId, e);
			});

			$(document).on('mouseup.colorpicker', function () {
				$(document).off('.colorpicker');
			});
		});

		// Hex input
		const $hexInput = $popover.find('.aisales-color-picker__hex-input');
		$hexInput.on('input', function () {
			let value = $(this).val().trim();
			if (!value.startsWith('#')) {
				value = '#' + value;
			}
			if (/^#[0-9A-Fa-f]{6}$/.test(value)) {
				setColorFromHex(inputId, value);
			}
		});

		$hexInput.on('blur', function () {
			// Reset to current valid color if invalid
			$(this).val(picker.currentColor);
		});

		// Preset colors
		$popover.on('click', '.aisales-color-picker__preset', function (e) {
			e.preventDefault();
			const color = $(this).data('color');
			setColorFromHex(inputId, color);

			// Update active state
			$popover.find('.aisales-color-picker__preset').removeClass('aisales-color-picker__preset--active');
			$(this).addClass('aisales-color-picker__preset--active');
		});

		// Close on outside click
		$(document).on('click', function (e) {
			if (picker.isOpen && !$(e.target).closest('.aisales-color-field').length) {
				closeColorPicker(inputId);
			}
		});

		// Close on escape
		$(document).on('keydown', function (e) {
			if (e.key === 'Escape' && picker.isOpen) {
				closeColorPicker(inputId);
			}
		});
	}

	/**
	 * Toggle color picker open/closed
	 */
	function toggleColorPicker(inputId) {
		const picker = colorPickers[inputId];

		if (picker.isOpen) {
			closeColorPicker(inputId);
		} else {
			// Close other pickers first
			Object.keys(colorPickers).forEach(id => {
				if (id !== inputId && colorPickers[id].isOpen) {
					closeColorPicker(id);
				}
			});
			openColorPicker(inputId);
		}
	}

	/**
	 * Open color picker
	 */
	function openColorPicker(inputId) {
		const picker = colorPickers[inputId];
		picker.isOpen = true;

		const $trigger = $(`.aisales-color-trigger[data-picker-id="${inputId}"]`);
		const $popover = $(`.aisales-color-popover[data-picker-id="${inputId}"]`);

		$trigger.addClass('aisales-color-trigger--active');
		$popover.addClass('aisales-color-popover--open');
	}

	/**
	 * Close color picker
	 */
	function closeColorPicker(inputId) {
		const picker = colorPickers[inputId];
		picker.isOpen = false;

		const $trigger = $(`.aisales-color-trigger[data-picker-id="${inputId}"]`);
		const $popover = $(`.aisales-color-popover[data-picker-id="${inputId}"]`);

		$trigger.removeClass('aisales-color-trigger--active');
		$popover.removeClass('aisales-color-popover--open');
	}

	/**
	 * Handle saturation/brightness area changes
	 */
	function handleSaturationChange(inputId, e) {
		const picker = colorPickers[inputId];
		const $saturation = $(`.aisales-color-picker__saturation[data-picker-id="${inputId}"]`);
		const rect = $saturation[0].getBoundingClientRect();

		let x = (e.clientX - rect.left) / rect.width;
		let y = (e.clientY - rect.top) / rect.height;

		x = Math.max(0, Math.min(1, x));
		y = Math.max(0, Math.min(1, y));

		picker.saturation = Math.round(x * 100);
		picker.brightness = Math.round((1 - y) * 100);

		updateColorFromHsb(inputId);
		updateCursorPositions(inputId);
	}

	/**
	 * Handle hue slider changes
	 */
	function handleHueChange(inputId, e) {
		const picker = colorPickers[inputId];
		const $hue = $(`.aisales-color-picker__hue[data-picker-id="${inputId}"]`);
		const rect = $hue[0].getBoundingClientRect();

		let x = (e.clientX - rect.left) / rect.width;
		x = Math.max(0, Math.min(1, x));

		picker.hue = Math.round(x * 360);

		updateColorFromHsb(inputId);
		updateSaturationBackground(inputId);
		updateCursorPositions(inputId);
	}

	/**
	 * Set color from hex value
	 */
	function setColorFromHex(inputId, hex) {
		const picker = colorPickers[inputId];
		const hsb = hexToHsb(hex);

		picker.hue = hsb.h;
		picker.saturation = hsb.s;
		picker.brightness = hsb.b;
		picker.currentColor = hex;

		updateColorUI(inputId, hex);
		updateSaturationBackground(inputId);
		updateCursorPositions(inputId);

		// Update the original input
		picker.$input.val(hex);
		pageState.isDirty = true;
		updatePreview();
	}

	/**
	 * Update color from HSB values
	 */
	function updateColorFromHsb(inputId) {
		const picker = colorPickers[inputId];
		const hex = hsbToHex(picker.hue, picker.saturation, picker.brightness);

		picker.currentColor = hex;
		updateColorUI(inputId, hex);

		// Update the original input
		picker.$input.val(hex);
		pageState.isDirty = true;
		updatePreview();
	}

	/**
	 * Update color picker UI elements
	 */
	function updateColorUI(inputId, hex) {
		const $trigger = $(`.aisales-color-trigger[data-picker-id="${inputId}"]`);
		const $popover = $(`.aisales-color-popover[data-picker-id="${inputId}"]`);

		// Update trigger
		$trigger.find('.aisales-color-trigger__swatch-color').css('background-color', hex);
		$trigger.find('.aisales-color-trigger__value').text(hex);

		// Update hex input
		$popover.find('.aisales-color-picker__hex-input').val(hex);

		// Update preset active state
		$popover.find('.aisales-color-picker__preset').removeClass('aisales-color-picker__preset--active');
		$popover.find(`.aisales-color-picker__preset[data-color="${hex}"]`).addClass('aisales-color-picker__preset--active');
	}

	/**
	 * Update saturation area background based on current hue
	 */
	function updateSaturationBackground(inputId) {
		const picker = colorPickers[inputId];
		const hueColor = hsbToHex(picker.hue, 100, 100);
		const $saturation = $(`.aisales-color-picker__saturation[data-picker-id="${inputId}"]`);

		$saturation.css('background-color', hueColor);
	}

	/**
	 * Update cursor positions based on current values
	 */
	function updateCursorPositions(inputId) {
		const picker = colorPickers[inputId];

		// Saturation cursor
		const $saturationCursor = $(`.aisales-color-picker__saturation[data-picker-id="${inputId}"] .aisales-color-picker__saturation-cursor`);
		$saturationCursor.css({
			left: picker.saturation + '%',
			top: (100 - picker.brightness) + '%',
			backgroundColor: picker.currentColor,
		});

		// Hue cursor
		const $hueCursor = $(`.aisales-color-picker__hue[data-picker-id="${inputId}"] .aisales-color-picker__hue-cursor`);
		$hueCursor.css({
			left: (picker.hue / 360 * 100) + '%',
			backgroundColor: hsbToHex(picker.hue, 100, 100),
		});
	}

	/**
	 * Convert hex to HSB
	 */
	function hexToHsb(hex) {
		hex = hex.replace('#', '');
		const r = parseInt(hex.substr(0, 2), 16) / 255;
		const g = parseInt(hex.substr(2, 2), 16) / 255;
		const b = parseInt(hex.substr(4, 2), 16) / 255;

		const max = Math.max(r, g, b);
		const min = Math.min(r, g, b);
		const d = max - min;

		let h = 0;
		const s = max === 0 ? 0 : (d / max) * 100;
		const v = max * 100;

		if (d !== 0) {
			switch (max) {
				case r:
					h = ((g - b) / d + (g < b ? 6 : 0)) * 60;
					break;
				case g:
					h = ((b - r) / d + 2) * 60;
					break;
				case b:
					h = ((r - g) / d + 4) * 60;
					break;
			}
		}

		return { h: Math.round(h), s: Math.round(s), b: Math.round(v) };
	}

	/**
	 * Convert HSB to hex
	 */
	function hsbToHex(h, s, b) {
		s /= 100;
		b /= 100;

		const k = (n) => (n + h / 60) % 6;
		const f = (n) => b * (1 - s * Math.max(0, Math.min(k(n), 4 - k(n), 1)));

		const r = Math.round(f(5) * 255);
		const g = Math.round(f(3) * 255);
		const bl = Math.round(f(1) * 255);

		return '#' + [r, g, bl].map(x => x.toString(16).padStart(2, '0')).join('');
	}

	/**
	 * Set color picker value programmatically
	 */
	function setColorPickerValue(inputId, hex) {
		if (colorPickers[inputId]) {
			setColorFromHex(inputId, hex);
		}
	}

	/**
	 * Initialize tone selection visual state
	 */
	function initToneSelection() {
		$('.aisales-tone-option').each(function () {
			const $option = $(this);
			const $radio = $option.find('input[type="radio"]');

			if ($radio.is(':checked')) {
				$option.addClass('aisales-tone-option--selected');
			}
		});
	}

	/**
	 * Handle tone selection change
	 */
	function handleToneChange() {
		const $selected = $(this);
		const $parent = $selected.closest('.aisales-tone-options:not(.aisales-promo-options)');
		$parent.find('.aisales-tone-option').removeClass('aisales-tone-option--selected');
		$selected.closest('.aisales-tone-option').addClass('aisales-tone-option--selected');
	}

	/**
	 * Handle promotion style selection change
	 */
	function handlePromotionStyleChange() {
		const $selected = $(this);
		const $parent = $selected.closest('.aisales-promo-options');
		$parent.find('.aisales-tone-option').removeClass('aisales-tone-option--selected');
		$selected.closest('.aisales-tone-option').addClass('aisales-tone-option--selected');
	}

	/**
	 * Show a specific view
	 */
	function showView(view) {
		pageState.currentView = view;

		$emptyState.hide();
		$analyzingState.hide();
		$reviewState.hide();
		$formState.hide();

		switch (view) {
			case 'empty':
				$emptyState.show();
				break;
			case 'analyzing':
				$analyzingState.show();
				break;
			case 'review':
				$reviewState.show();
				break;
			case 'form':
				$formState.show();
				break;
		}
	}

	/**
	 * Start AI analysis
	 */
	function startAnalysis(e) {
		e.preventDefault();

		if (pageState.isLoading) {
			return;
		}

		// Track if we came from form state (for error recovery)
		const cameFromForm = pageState.currentView === 'form';

		pageState.isLoading = true;
		showView('analyzing');
		animateAnalysisSteps();

		// Make AJAX call to analyze brand
		$.ajax({
			url: aisalesBrand.ajaxUrl,
			type: 'POST',
			data: {
				action: 'aisales_analyze_brand',
				nonce: aisalesBrand.nonce,
			},
			success: function (response) {
				pageState.isLoading = false;

				if (response.success && response.data && response.data.suggestions) {
					pageState.suggestions = response.data.suggestions;
					showReviewState(response.data.suggestions);

					// Update balance if returned
					if (response.data.balance !== undefined) {
						updateBalanceDisplay(response.data.balance);
					}
				} else {
					const errorMsg = response.data?.message || aisalesBrand.i18n.analyzeError;
					showToast(errorMsg, 'error');
					// Return to form if we came from there, otherwise empty state
					showView(cameFromForm ? 'form' : 'empty');
				}
			},
			error: function (xhr, status, error) {
				pageState.isLoading = false;
				console.error('Brand analysis error:', status, error);
				showToast(aisalesBrand.i18n.connectionError, 'error');
				// Return to form if we came from there, otherwise empty state
				showView(cameFromForm ? 'form' : 'empty');
			},
		});
	}

	/**
	 * Animate analysis steps
	 */
	function animateAnalysisSteps() {
		const $steps = $('.aisales-brand-analyzing__step');
		let currentStep = 0;

		// Reset all steps
		$steps.removeClass('aisales-brand-analyzing__step--active aisales-brand-analyzing__step--complete');

		function activateStep() {
			if (currentStep >= $steps.length || pageState.currentView !== 'analyzing') {
				return;
			}

			// Complete previous steps
			$steps.slice(0, currentStep).addClass('aisales-brand-analyzing__step--complete').removeClass('aisales-brand-analyzing__step--active');

			// Activate current step
			$steps.eq(currentStep).addClass('aisales-brand-analyzing__step--active');

			currentStep++;

			if (currentStep < $steps.length) {
				setTimeout(activateStep, 1500);
			}
		}

		activateStep();
	}

	/**
	 * Show review state with suggestions
	 */
	function showReviewState(suggestions) {
		const $container = $('#aisales-brand-suggestions');
		$container.empty();

		const html = [
			buildIdentitySection(suggestions),
			buildPositioningSection(suggestions),
			buildVoiceSection(suggestions),
			buildStyleSection(suggestions),
			buildPreviewSection(suggestions),
		].join('');

		$container.html(html);
		showView('review');
	}

	/**
	 * Build Store Identity section
	 */
	function buildIdentitySection(suggestions) {
		const items = [
			suggestions.store_name && buildSuggestionItem('Store Name', suggestions.store_name),
			suggestions.tagline && buildSuggestionItem('Tagline', suggestions.tagline, 'tagline'),
			suggestions.business_niche && buildSuggestionItem('Business Niche', suggestions.business_niche),
			suggestions.target_audience && buildSuggestionItem('Target Audience', suggestions.target_audience),
		].filter(Boolean).join('');

		return buildSection('store', 'Store Identity', items);
	}

	/**
	 * Build Audience & Positioning section
	 */
	function buildPositioningSection(suggestions) {
		const items = [];

		if (suggestions.price_position) {
			const label = aisalesBrand.pricePositions?.[suggestions.price_position] || suggestions.price_position;
			items.push(buildBadgeItem('Price Positioning', label, 'position', suggestions.price_position));
		}

		if (suggestions.differentiator) {
			items.push(buildSuggestionItem('What Sets You Apart', suggestions.differentiator, 'differentiator'));
		}

		if (suggestions.pain_points) {
			items.push(buildSuggestionItem('Customer Pain Points', suggestions.pain_points, 'pain-points'));
		}

		if (items.length === 0) {
			return '';
		}

		return buildSection('chart-pie', 'Audience & Positioning', items.join(''));
	}

	/**
	 * Build Brand Voice section
	 */
	function buildVoiceSection(suggestions) {
		const items = [];

		if (suggestions.brand_tone) {
			const info = aisalesBrand.tones?.[suggestions.brand_tone];
			items.push(buildBadgeItem('Brand Tone', info?.label || suggestions.brand_tone, 'tone', suggestions.brand_tone, info?.description));
		}

		if (suggestions.promotion_style) {
			const info = aisalesBrand.promotionStyles?.[suggestions.promotion_style];
			items.push(buildBadgeItem('Promotion Style', info?.label || suggestions.promotion_style, 'promo', suggestions.promotion_style, info?.description, info?.icon));
		}

		if (suggestions.brand_values?.length > 0) {
			items.push(buildTagsItem('Brand Values', suggestions.brand_values, 'value'));
		}

		if (suggestions.words_to_avoid) {
			const words = suggestions.words_to_avoid.split(',').map(w => w.trim()).filter(Boolean);
			if (words.length > 0) {
				items.push(buildTagsItem('Words to Avoid', words, 'avoid'));
			}
		}

		return buildSection('megaphone', 'Brand Voice', items.join(''));
	}

	/**
	 * Build Visual Style section
	 */
	function buildStyleSection(suggestions) {
		const items = [];

		// Color palette
		const hasColors = suggestions.primary_color || suggestions.text_color || suggestions.bg_color;
		if (hasColors) {
			const swatches = [
				suggestions.primary_color && buildColorSwatch('Primary', suggestions.primary_color),
				suggestions.text_color && buildColorSwatch('Text', suggestions.text_color),
				suggestions.bg_color && buildColorSwatch('Background', suggestions.bg_color, true),
			].filter(Boolean).join('');

			items.push(`
				<div class="aisales-brand-suggestion aisales-brand-suggestion--colors">
					<span class="aisales-brand-suggestion__label">Color Palette</span>
					<div class="aisales-color-palette">${swatches}</div>
				</div>
			`);
		}

		// Typography
		if (suggestions.font_family) {
			const fontInfo = aisalesBrand.safeFonts?.[suggestions.font_family];
			const fontName = fontInfo?.name || suggestions.font_family;
			const fontStack = fontInfo?.family || suggestions.font_family;

			items.push(`
				<div class="aisales-brand-suggestion aisales-brand-suggestion--font">
					<span class="aisales-brand-suggestion__label">Typography</span>
					<div class="aisales-font-preview" style="font-family: ${fontStack}">
						<span class="aisales-font-preview__sample">Aa</span>
						<span class="aisales-font-preview__name">${escapeHtml(fontName)}</span>
					</div>
				</div>
			`);
		}

		return buildSection('art', 'Visual Style', items.join(''));
	}

	/**
	 * Build Email Preview section with browser frame
	 */
	function buildPreviewSection(suggestions) {
		if (!suggestions.primary_color || !suggestions.store_name) {
			return '';
		}

		const bg = suggestions.bg_color || '#f9fafb';
		const text = suggestions.text_color || '#111827';
		const primary = suggestions.primary_color;
		const font = aisalesBrand.safeFonts?.[suggestions.font_family]?.family || 'system-ui, sans-serif';
		const contrastColor = getContrastColor(primary);
		const tagline = suggestions.tagline ? escapeHtml(suggestions.tagline) : 'Thank you for shopping with us.';

		return `
			<div class="aisales-review-section aisales-review-section--preview">
				<h3 class="aisales-review-section__title"><span class="dashicons dashicons-visibility"></span> Email Preview</h3>
				<div class="aisales-review-preview">
					<div class="aisales-review-preview__frame">
						<div class="aisales-review-preview__chrome">
							<span class="aisales-review-preview__dot aisales-review-preview__dot--red"></span>
							<span class="aisales-review-preview__dot aisales-review-preview__dot--yellow"></span>
							<span class="aisales-review-preview__dot aisales-review-preview__dot--green"></span>
						</div>
						<div class="aisales-review-preview__email" style="background: ${bg}; font-family: ${font};">
							<div class="aisales-review-preview__header" style="background: ${primary}; color: ${contrastColor};">
								${escapeHtml(suggestions.store_name)}
							</div>
							<div class="aisales-review-preview__body" style="color: ${text};">
								<p class="aisales-review-preview__greeting">Hi there!</p>
								<p class="aisales-review-preview__text">${tagline}</p>
								<button class="aisales-review-preview__cta" style="background: ${primary}; color: ${contrastColor};">Shop Now</button>
							</div>
						</div>
					</div>
				</div>
			</div>
		`;
	}

	/**
	 * Build a review section wrapper
	 */
	function buildSection(icon, title, content) {
		return `
			<div class="aisales-review-section">
				<h3 class="aisales-review-section__title"><span class="dashicons dashicons-${icon}"></span> ${title}</h3>
				<div class="aisales-review-section__content">${content}</div>
			</div>
		`;
	}

	/**
	 * Build a color swatch HTML
	 */
	function buildColorSwatch(name, color, hasBorder) {
		const borderStyle = hasBorder ? ' border: 1px solid #e0e0e0;' : '';
		return `
			<div class="aisales-color-swatch">
				<span class="aisales-color-swatch__preview" style="background-color: ${color};${borderStyle}"></span>
				<span class="aisales-color-swatch__info">
					<span class="aisales-color-swatch__name">${name}</span>
					<span class="aisales-color-swatch__value">${color}</span>
				</span>
			</div>
		`;
	}

	/**
	 * Build a suggestion item HTML
	 */
	function buildSuggestionItem(label, value, modifier) {
		const modifierClass = modifier ? ` aisales-brand-suggestion--${modifier}` : '';
		return `
			<div class="aisales-brand-suggestion${modifierClass}">
				<span class="aisales-brand-suggestion__label">${escapeHtml(label)}</span>
				<span class="aisales-brand-suggestion__value">${escapeHtml(value)}</span>
			</div>
		`;
	}

	/**
	 * Build a badge item HTML (for tone, position, promotion style)
	 */
	function buildBadgeItem(label, text, type, variant, description, icon) {
		const descHtml = description ? `<span class="aisales-brand-suggestion__tone-desc">${escapeHtml(description)}</span>` : '';
		const iconHtml = icon ? `<span class="dashicons ${icon}"></span>` : '';
		const badgeClass = `aisales-${type}-badge aisales-${type}-badge--${variant}`;
		
		return `
			<div class="aisales-brand-suggestion aisales-brand-suggestion--${type}">
				<span class="aisales-brand-suggestion__label">${escapeHtml(label)}</span>
				<div class="aisales-brand-suggestion__tone-value">
					<span class="${badgeClass}">${iconHtml}${escapeHtml(text)}</span>
					${descHtml}
				</div>
			</div>
		`;
	}

	/**
	 * Build a tags list item HTML (for brand values, words to avoid)
	 */
	function buildTagsItem(label, items, tagType) {
		const tags = items.map(item => `<span class="aisales-${tagType}-tag">${escapeHtml(item)}</span>`).join('');
		return `
			<div class="aisales-brand-suggestion">
				<span class="aisales-brand-suggestion__label">${escapeHtml(label)}</span>
				<div class="aisales-brand-suggestion__values">${tags}</div>
			</div>
		`;
	}

	/**
	 * Continue to settings - populate form with suggestions and show form
	 */
	function continueToSettings() {
		if (pageState.suggestions) {
			populateFormWithSuggestions(pageState.suggestions);
		}

		pageState.isDirty = true;
		showFormView();

		// Scroll to top of form
		$('html, body').animate({ scrollTop: $('.aisales-brand-page').offset().top - 32 }, 300);
	}

	/**
	 * Populate form fields with suggestion data
	 */
	function populateFormWithSuggestions(suggestions) {
		// Store Identity
		if (suggestions.store_name) {
			$('#aisales-store-name').val(suggestions.store_name);
		}
		if (suggestions.tagline) {
			$('#aisales-tagline').val(suggestions.tagline);
		}
		if (suggestions.business_niche) {
			$('#aisales-industry').val(suggestions.business_niche);
		}

		// Audience & Positioning
		if (suggestions.target_audience) {
			$('#aisales-target-audience').val(suggestions.target_audience);
		}
		if (suggestions.price_position) {
			$('#aisales-price-position').val(suggestions.price_position);
		}
		if (suggestions.differentiator) {
			$('#aisales-differentiator').val(suggestions.differentiator);
		}
		if (suggestions.pain_points) {
			$('#aisales-pain-points').val(suggestions.pain_points);
		}

		// Brand Voice
		if (suggestions.brand_tone) {
			$(`input[name="brand_tone"][value="${suggestions.brand_tone}"]`).prop('checked', true).trigger('change');
		}
		if (suggestions.words_to_avoid) {
			$('#aisales-words-avoid').val(suggestions.words_to_avoid);
		}
		if (suggestions.promotion_style) {
			$(`input[name="promotion_style"][value="${suggestions.promotion_style}"]`).prop('checked', true).trigger('change');
		}
		
		// Apply color suggestions using custom color picker
		if (suggestions.primary_color) {
			setColorPickerValue('aisales-primary-color', suggestions.primary_color);
		}
		if (suggestions.text_color) {
			setColorPickerValue('aisales-text-color', suggestions.text_color);
		}
		if (suggestions.bg_color) {
			setColorPickerValue('aisales-bg-color', suggestions.bg_color);
		}
		
		// Apply font suggestion
		if (suggestions.font_family) {
			$('#aisales-font-family').val(suggestions.font_family);
		}
		
		// Update preview with new values
		updatePreview();
	}

	/**
	 * Show form view
	 */
	function showFormView() {
		showView('form');
		updatePreview();
	}

	/**
	 * Handle form submission
	 */
	function handleFormSubmit(e) {
		e.preventDefault();
		saveSettings();
	}

	/**
	 * Save settings via AJAX
	 */
	function saveSettings() {
		if (pageState.isLoading) {
			return;
		}

		pageState.isLoading = true;
		$saveBtn.prop('disabled', true).html(`<span class="dashicons dashicons-update-alt aisales-spin"></span> ${aisalesBrand.i18n.saving}`);

		const formData = $form.serializeArray();
		const data = {
			action: 'aisales_save_brand_settings',
			nonce: aisalesBrand.nonce,
		};

		formData.forEach(function (item) {
			data[item.name] = item.value;
		});

		// Get color picker values (they may not be in serializeArray)
		data.primary_color = $('#aisales-primary-color').val();
		data.text_color = $('#aisales-text-color').val();
		data.bg_color = $('#aisales-bg-color').val();

		$.ajax({
			url: aisalesBrand.ajaxUrl,
			type: 'POST',
			data: data,
			success: function (response) {
				pageState.isLoading = false;
				$saveBtn.prop('disabled', false).html(`<span class="dashicons dashicons-saved"></span> ${aisalesBrand.i18n.saveSettings}`);

				if (response.success) {
					pageState.isDirty = false;
					showToast(aisalesBrand.i18n.settingsSaved, 'success');

					// Update header if re-analyze button should appear
					if (!$('#aisales-brand-reanalyze-btn').length) {
						$('.aisales-brand-page__header-right').prepend(`
							<button type="button" class="aisales-brand-reanalyze-trigger" id="aisales-brand-reanalyze-btn">
								<span class="dashicons dashicons-admin-customizer"></span>
								${aisalesBrand.i18n.aiAnalyze || 'AI Re-analyze'}
							</button>
						`);
					}
				} else {
					showToast(response.data?.message || aisalesBrand.i18n.error, 'error');
				}
			},
			error: function () {
				pageState.isLoading = false;
				$saveBtn.prop('disabled', false).html(`<span class="dashicons dashicons-saved"></span> ${aisalesBrand.i18n.saveSettings}`);
				showToast(aisalesBrand.i18n.connectionError, 'error');
			},
		});
	}

	/**
	 * Reset colors to detected values
	 */
	function resetColors() {
		const detected = aisalesBrand.detectedBranding?.colors || {};

		if (detected.primary) {
			setColorPickerValue('aisales-primary-color', detected.primary);
		}
		if (detected.text) {
			setColorPickerValue('aisales-text-color', detected.text);
		}
		if (detected.background) {
			setColorPickerValue('aisales-bg-color', detected.background);
		}

		updatePreview();
		pageState.isDirty = true;
		showToast(aisalesBrand.i18n.colorsReset, 'success');
	}

	/**
	 * Update live preview
	 */
	function updatePreview() {
		const primaryColor = $('#aisales-primary-color').val() || '#7f54b3';
		const textColor = $('#aisales-text-color').val() || '#3c3c3c';
		const bgColor = $('#aisales-bg-color').val() || '#f7f7f7';
		const fontSlug = $('#aisales-font-family').val() || 'system';

		// Get font family from safe fonts
		let fontFamily = 'system-ui, sans-serif';
		if (aisalesBrand.safeFonts && aisalesBrand.safeFonts[fontSlug]) {
			fontFamily = aisalesBrand.safeFonts[fontSlug].family;
		}

		// Update preview box
		$('#aisales-preview-header').css({
			backgroundColor: primaryColor,
			color: getContrastColor(primaryColor),
		});

		$('#aisales-preview-body').css({
			backgroundColor: '#ffffff',
			fontFamily: fontFamily,
		});

		$('.aisales-brand-preview__box').css({
			backgroundColor: bgColor,
		});

		$('.aisales-brand-preview__heading, .aisales-brand-preview__text').css({
			color: textColor,
		});

		$('#aisales-preview-button').css({
			backgroundColor: primaryColor,
			color: getContrastColor(primaryColor),
		});
	}

	/**
	 * Update preview store name
	 */
	function updatePreviewStoreName() {
		const storeName = $(this).val() || 'Your Store';
		$('#aisales-preview-header').text(storeName);
	}

	/**
	 * Get contrasting text color (black or white)
	 */
	function getContrastColor(hex) {
		if (!hex) return '#ffffff';

		hex = hex.replace('#', '');
		const r = parseInt(hex.substr(0, 2), 16);
		const g = parseInt(hex.substr(2, 2), 16);
		const b = parseInt(hex.substr(4, 2), 16);
		const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;

		return luminance > 0.5 ? '#000000' : '#ffffff';
	}

	/**
	 * Update balance display in header
	 */
	function updateBalanceDisplay(balance) {
		const $balanceAmount = $('.aisales-balance__amount');
		if ($balanceAmount.length && typeof balance === 'number') {
			$balanceAmount.text(balance.toLocaleString());
		}
	}

	/**
	 * Show toast notification
	 */
	function showToast(message, type) {
		const icon = type === 'success' ? 'yes-alt' : 'warning';

		// Remove any existing toast
		$('.aisales-toast').remove();

		const $toast = $(`
			<div class="aisales-toast aisales-toast--${type}">
				<span class="aisales-toast__icon">
					<span class="dashicons dashicons-${icon}"></span>
				</span>
				<span class="aisales-toast__message">${escapeHtml(message)}</span>
			</div>
		`);

		$('body').append($toast);

		// Auto-remove after 4 seconds
		setTimeout(function () {
			$toast.fadeOut(300, function () {
				$(this).remove();
			});
		}, 4000);
	}

	/**
	 * Escape HTML for safe insertion
	 */
	function escapeHtml(text) {
		const div = document.createElement('div');
		div.textContent = text;
		return div.innerHTML;
	}

	// Initialize when document is ready
	$(document).ready(init);

})(jQuery);
