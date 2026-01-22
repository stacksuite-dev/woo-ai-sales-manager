/**
 * Email Template Wizard JavaScript
 *
 * Handles the first-time wizard experience for email template generation.
 * Guides users through brand context setup and template selection before
 * generating AI-powered email templates.
 *
 * @package AISales_Sales_Manager
 */

(function ($) {
	'use strict';

	// Wizard state
	const wizardState = {
		isOpen: false,
		currentStep: 1,
		totalSteps: 4,
		context: {
			store_name: '',
			business_niche: '',
			brand_tone: 'friendly',
			target_audience: '',
			// Branding fields
			primary_color: '#7f54b3',
			text_color: '#3c3c3c',
			bg_color: '#f7f7f7',
			font_family: 'system',
		},
		selectedTemplates: [],
		generatedTemplates: [],
		errors: [],
		singleTemplateMode: false,
		singleTemplateType: null,
		settingsOnly: false, // When true, only show Step 1 for brand settings
	};

	// Cache DOM elements
	let $overlay, $wizard, $steps, $progressSteps;

	/**
	 * Initialize the wizard
	 */
	function init() {
		cacheElements();
		bindEvents();
		loadExistingContext();
	}

	/**
	 * Cache DOM elements
	 */
	function cacheElements() {
		$overlay = $('#aisales-wizard-overlay');
		$wizard = $('#aisales-email-wizard');
		$steps = $('.aisales-wizard__step');
		$progressSteps = $('.aisales-wizard__progress-step');
	}

	/**
	 * Bind event handlers
	 */
	function bindEvents() {
		// Close wizard
		$(document).on('click', '.aisales-wizard__close, .aisales-wizard-overlay', function (e) {
			if (e.target === this) {
				closeWizard();
			}
		});

		// Skip button
		$(document).on('click', '.aisales-wizard__skip-btn', handleSkip);

		// Navigation buttons
		$(document).on('click', '#aisales-wizard-prev', goToPrevStep);
		$(document).on('click', '#aisales-wizard-next', goToNextStep);

		// Tone selection
		$(document).on('change', 'input[name="wizard_brand_tone"]', function () {
			wizardState.context.brand_tone = $(this).val();
		});

		// Template selection
		$(document).on('click', '.aisales-wizard__template-item', handleTemplateToggle);
		$(document).on('click', '#aisales-wizard-select-all', selectAllTemplates);
		$(document).on('click', '#aisales-wizard-select-none', selectNoTemplates);

		// Form input changes
		$(document).on('input change', '#aisales-wizard-store-name', function () {
			wizardState.context.store_name = $(this).val();
		});
		$(document).on('change', '#aisales-wizard-business-niche', function () {
			wizardState.context.business_niche = $(this).val();
		});
		$(document).on('input change', '#aisales-wizard-target-audience', function () {
			wizardState.context.target_audience = $(this).val();
		});

		// Branding: Color picker changes
		$(document).on('input change', '#aisales-wizard-primary-color', function () {
			const color = $(this).val();
			wizardState.context.primary_color = color;
			$('#aisales-wizard-primary-color-hex').val(color);
			updateBrandingPreview();
		});
		$(document).on('input change', '#aisales-wizard-text-color', function () {
			const color = $(this).val();
			wizardState.context.text_color = color;
			$('#aisales-wizard-text-color-hex').val(color);
			updateBrandingPreview();
		});
		$(document).on('input change', '#aisales-wizard-bg-color', function () {
			const color = $(this).val();
			wizardState.context.bg_color = color;
			$('#aisales-wizard-bg-color-hex').val(color);
			updateBrandingPreview();
		});

		// Branding: Hex input changes (sync back to color picker)
		$(document).on('input change', '#aisales-wizard-primary-color-hex', function () {
			const color = sanitizeHexColor($(this).val());
			if (color) {
				wizardState.context.primary_color = color;
				$('#aisales-wizard-primary-color').val(color);
				updateBrandingPreview();
			}
		});
		$(document).on('input change', '#aisales-wizard-text-color-hex', function () {
			const color = sanitizeHexColor($(this).val());
			if (color) {
				wizardState.context.text_color = color;
				$('#aisales-wizard-text-color').val(color);
				updateBrandingPreview();
			}
		});
		$(document).on('input change', '#aisales-wizard-bg-color-hex', function () {
			const color = sanitizeHexColor($(this).val());
			if (color) {
				wizardState.context.bg_color = color;
				$('#aisales-wizard-bg-color').val(color);
				updateBrandingPreview();
			}
		});

		// Branding: Font family change
		$(document).on('change', '#aisales-wizard-font-family', function () {
			const $selected = $(this).find('option:selected');
			wizardState.context.font_family = $(this).val();
			const fontStack = $selected.data('family') || 'system-ui, sans-serif';
			$('#aisales-wizard-font-preview').css('font-family', fontStack);
			updateBrandingPreview();
		});

		// Escape key to close
		$(document).on('keydown', function (e) {
			if (e.key === 'Escape' && wizardState.isOpen) {
				closeWizard();
			}
		});

		// Finish button
		$(document).on('click', '#aisales-wizard-finish', finishWizard);
	}

	/**
	 * Sanitize hex color input
	 * Returns valid hex color or null
	 */
	function sanitizeHexColor(input) {
		if (!input) return null;
		
		// Remove any whitespace
		let color = input.trim();
		
		// Add # if missing
		if (!color.startsWith('#')) {
			color = '#' + color;
		}
		
		// Validate hex format (3 or 6 characters after #)
		if (/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/.test(color)) {
			// Expand 3-char hex to 6-char
			if (color.length === 4) {
				color = '#' + color[1] + color[1] + color[2] + color[2] + color[3] + color[3];
			}
			return color.toLowerCase();
		}
		
		return null;
	}

	/**
	 * Update the branding preview section
	 */
	function updateBrandingPreview() {
		const ctx = wizardState.context;
		
		// Update preview header (primary color background)
		$('#aisales-preview-header').css('background-color', ctx.primary_color);
		
		// Update preview body (text color and background)
		$('#aisales-preview-body').css({
			'color': ctx.text_color,
			'background-color': ctx.bg_color
		});
		
		// Update preview button (primary color background)
		$('#aisales-preview-button').css('background-color', ctx.primary_color);
		
		// Update preview container background
		$('#aisales-wizard-email-preview').css('background-color', ctx.bg_color);
		
		// Update font family
		const $fontSelect = $('#aisales-wizard-font-family');
		const $selectedOption = $fontSelect.find('option:selected');
		const fontStack = $selectedOption.data('family') || 'system-ui, sans-serif';
		$('#aisales-wizard-email-preview').css('font-family', fontStack);
	}

	/**
	 * Load existing store context if available
	 */
	function loadExistingContext() {
		if (window.aisalesWizardData?.context) {
			const ctx = window.aisalesWizardData.context;
			wizardState.context = {
				store_name: ctx.store_name || '',
				business_niche: ctx.business_niche || '',
				brand_tone: ctx.brand_tone || 'friendly',
				target_audience: ctx.target_audience || '',
				// Branding fields
				primary_color: ctx.primary_color || '#7f54b3',
				text_color: ctx.text_color || '#3c3c3c',
				bg_color: ctx.bg_color || '#f7f7f7',
				font_family: ctx.font_family || 'system',
			};
		}
	}

	/**
	 * Open the wizard
	 * @param {string|null} singleTemplateType - If set, only generate this template
	 * @param {boolean} settingsOnly - If true, only show Step 1 for brand settings editing
	 */
	function openWizard(singleTemplateType = null, settingsOnly = false) {
		wizardState.isOpen = true;
		wizardState.currentStep = 1;
		wizardState.singleTemplateMode = !!singleTemplateType;
		wizardState.singleTemplateType = singleTemplateType;
		wizardState.settingsOnly = settingsOnly;
		wizardState.generatedTemplates = [];
		wizardState.errors = [];

		// Pre-populate form fields
		populateFormFields();

		// Pre-select templates
		if (singleTemplateType) {
			wizardState.selectedTemplates = [singleTemplateType];
		} else {
			// Select all missing templates by default
			wizardState.selectedTemplates = getMissingTemplateTypes();
		}
		updateTemplateSelectionUI();

		// Show wizard
		$overlay.addClass('aisales-wizard-overlay--open');
		$('body').addClass('aisales-wizard-active');

		// Update UI
		updateStepUI();
		updateProgressUI();
	}

	/**
	 * Close the wizard
	 */
	function closeWizard() {
		wizardState.isOpen = false;
		$overlay.removeClass('aisales-wizard-overlay--open');
		$('body').removeClass('aisales-wizard-active');
	}

	/**
	 * Populate form fields with existing context
	 */
	function populateFormFields() {
		const ctx = wizardState.context;
		
		// Basic fields
		$('#aisales-wizard-store-name').val(ctx.store_name);
		$('#aisales-wizard-business-niche').val(ctx.business_niche);
		$('#aisales-wizard-target-audience').val(ctx.target_audience);
		$(`input[name="wizard_brand_tone"][value="${ctx.brand_tone}"]`).prop('checked', true);
		
		// Branding: Color fields
		$('#aisales-wizard-primary-color').val(ctx.primary_color);
		$('#aisales-wizard-primary-color-hex').val(ctx.primary_color);
		$('#aisales-wizard-text-color').val(ctx.text_color);
		$('#aisales-wizard-text-color-hex').val(ctx.text_color);
		$('#aisales-wizard-bg-color').val(ctx.bg_color);
		$('#aisales-wizard-bg-color-hex').val(ctx.bg_color);
		
		// Branding: Font family
		$('#aisales-wizard-font-family').val(ctx.font_family);
		
		// Update font preview
		const $fontSelect = $('#aisales-wizard-font-family');
		const $selectedOption = $fontSelect.find('option:selected');
		if ($selectedOption.length) {
			const fontStack = $selectedOption.data('family') || 'system-ui, sans-serif';
			$('#aisales-wizard-font-preview').css('font-family', fontStack);
		}
		
		// Update branding preview
		updateBrandingPreview();
	}

	/**
	 * Get missing template types
	 */
	function getMissingTemplateTypes() {
		const missing = [];
		if (window.aisalesWizardData?.templates) {
			Object.keys(window.aisalesWizardData.templates).forEach(type => {
				const template = window.aisalesWizardData.templates[type];
				if (!template.has_template) {
					missing.push(type);
				}
			});
		}
		return missing;
	}

	/**
	 * Handle skip button
	 */
	function handleSkip() {
		if (wizardState.currentStep === 1) {
			// Skip context setup, go to step 2
			goToNextStep();
		} else {
			closeWizard();
		}
	}

	/**
	 * Go to previous step
	 */
	function goToPrevStep() {
		if (wizardState.currentStep > 1) {
			wizardState.currentStep--;
			updateStepUI();
			updateProgressUI();
		}
	}

	/**
	 * Go to next step
	 */
	async function goToNextStep() {
		if (wizardState.currentStep === 1) {
			// Save context before proceeding
			await saveContext();

			// In settings-only mode, save and close after Step 1
			if (wizardState.settingsOnly) {
				showSaveSuccessNotice();
				closeWizard();
				return;
			}
		}

		if (wizardState.currentStep === 2) {
			// Validate template selection
			if (wizardState.selectedTemplates.length === 0) {
				alert(aisalesWizard.i18n.selectAtLeastOne || 'Please select at least one template to generate.');
				return;
			}
			// Start generation
			startGeneration();
			return;
		}

		if (wizardState.currentStep < wizardState.totalSteps) {
			wizardState.currentStep++;
			updateStepUI();
			updateProgressUI();
		}
	}

	/**
	 * Update step visibility
	 */
	function updateStepUI() {
		$steps.removeClass('aisales-wizard__step--active');
		$(`.aisales-wizard__step[data-step="${wizardState.currentStep}"]`).addClass('aisales-wizard__step--active');

		// Update header title based on step and mode
		let titles = {
			1: aisalesWizard.i18n.step1Title || 'Personalize Your Emails',
			2: aisalesWizard.i18n.step2Title || 'Choose Templates',
			3: aisalesWizard.i18n.step3Title || 'Generating...',
			4: aisalesWizard.i18n.step4Title || 'All Done!',
		};

		// Override title for settings-only mode
		if (wizardState.settingsOnly && wizardState.currentStep === 1) {
			titles[1] = aisalesWizard.i18n.brandSettingsTitle || 'Brand Settings';
		}

		$('.aisales-wizard__title span:last-child').text(titles[wizardState.currentStep] || '');

		// Update footer buttons
		updateFooterButtons();

		// If in single template mode, skip step 2
		if (wizardState.singleTemplateMode && wizardState.currentStep === 2) {
			startGeneration();
		}
	}

	/**
	 * Update progress indicators
	 */
	function updateProgressUI() {
		const $progress = $('.aisales-wizard__progress');

		// Hide progress bar in settings-only mode
		if (wizardState.settingsOnly) {
			$progress.hide();
			return;
		}

		$progress.show();
		$progressSteps.each(function (index) {
			const stepNum = index + 1;
			const $step = $(this);

			$step.removeClass('aisales-wizard__progress-step--active aisales-wizard__progress-step--completed');

			if (stepNum < wizardState.currentStep) {
				$step.addClass('aisales-wizard__progress-step--completed');
			} else if (stepNum === wizardState.currentStep) {
				$step.addClass('aisales-wizard__progress-step--active');
			}
		});
	}

	/**
	 * Update footer buttons based on current step
	 */
	function updateFooterButtons() {
		const $prev = $('#aisales-wizard-prev');
		const $next = $('#aisales-wizard-next');
		const $skip = $('.aisales-wizard__skip-btn');
		const $finish = $('#aisales-wizard-finish');

		// Hide all first
		$prev.hide();
		$next.hide();
		$skip.hide();
		$finish.hide();

		switch (wizardState.currentStep) {
			case 1:
				// In settings-only mode, hide skip and show "Save Settings"
				if (wizardState.settingsOnly) {
					$next.show().html('<span class="dashicons dashicons-yes"></span><span>' + 
						(aisalesWizard.i18n.saveSettings || 'Save Settings') + '</span>');
				} else {
					$skip.show().text(aisalesWizard.i18n.skipSetup || 'Skip setup');
					$next.show().html('<span>' + (aisalesWizard.i18n.continue || 'Continue') + '</span><span class="dashicons dashicons-arrow-right-alt"></span>');
				}
				break;
			case 2:
				$prev.show();
				const count = wizardState.selectedTemplates.length;
				$next.show().html('<span class="dashicons dashicons-admin-customizer"></span><span>' + 
					(aisalesWizard.i18n.generateCount || 'Generate {count} Template(s)').replace('{count}', count) + '</span>');
				$next.prop('disabled', count === 0);
				break;
			case 3:
				// No buttons during generation
				break;
			case 4:
				$finish.show().html('<span class="dashicons dashicons-yes-alt"></span><span>' + 
					(aisalesWizard.i18n.viewTemplates || 'View Templates') + '</span>');
				break;
		}
	}

	/**
	 * Handle template toggle
	 */
	function handleTemplateToggle() {
		const $item = $(this);
		const type = $item.data('template-type');

		if ($item.hasClass('is-disabled')) {
			return;
		}

		$item.toggleClass('is-selected');

		if ($item.hasClass('is-selected')) {
			if (!wizardState.selectedTemplates.includes(type)) {
				wizardState.selectedTemplates.push(type);
			}
		} else {
			wizardState.selectedTemplates = wizardState.selectedTemplates.filter(t => t !== type);
		}

		updateFooterButtons();
	}

	/**
	 * Select all templates
	 */
	function selectAllTemplates() {
		wizardState.selectedTemplates = getMissingTemplateTypes();
		updateTemplateSelectionUI();
		updateFooterButtons();
	}

	/**
	 * Select no templates
	 */
	function selectNoTemplates() {
		wizardState.selectedTemplates = [];
		updateTemplateSelectionUI();
		updateFooterButtons();
	}

	/**
	 * Update template selection UI
	 */
	function updateTemplateSelectionUI() {
		$('.aisales-wizard__template-item').each(function () {
			const $item = $(this);
			const type = $item.data('template-type');

			if (wizardState.selectedTemplates.includes(type)) {
				$item.addClass('is-selected');
			} else {
				$item.removeClass('is-selected');
			}
		});
	}

	/**
	 * Save context to server
	 */
	async function saveContext() {
		try {
			await $.ajax({
				url: aisalesWizard.ajaxUrl,
				type: 'POST',
				data: {
					action: 'aisales_save_wizard_context',
					nonce: aisalesWizard.nonce,
					context: wizardState.context,
				},
			});
			return true;
		} catch (error) {
			console.error('Failed to save context:', error);
			return false;
		}
	}

	/**
	 * Show a success notice after saving settings
	 */
	function showSaveSuccessNotice() {
		// Remove existing notices
		$('.aisales-email-notice').remove();

		const $notice = $(`
			<div class="notice notice-success is-dismissible aisales-email-notice">
				<p>${aisalesWizard.i18n.settingsSaved || 'Brand settings saved successfully!'}</p>
				<button type="button" class="notice-dismiss">
					<span class="screen-reader-text">Dismiss</span>
				</button>
			</div>
		`);

		$('.aisales-notices-anchor').after($notice);

		// Auto-dismiss after 5 seconds
		setTimeout(() => {
			$notice.fadeOut(300, function () {
				$(this).remove();
			});
		}, 5000);

		// Manual dismiss
		$notice.find('.notice-dismiss').on('click', function () {
			$notice.fadeOut(300, function () {
				$(this).remove();
			});
		});
	}

	/**
	 * Start template generation
	 */
	async function startGeneration() {
		wizardState.currentStep = 3;
		updateStepUI();
		updateProgressUI();

		// Build progress list
		buildProgressList();

		// Generate templates one by one
		for (let i = 0; i < wizardState.selectedTemplates.length; i++) {
			const templateType = wizardState.selectedTemplates[i];
			await generateTemplate(templateType, i);
		}

		// Move to completion step
		wizardState.currentStep = 4;
		updateStepUI();
		updateProgressUI();
		showCompletionSummary();
	}

	/**
	 * Build the progress list UI
	 */
	function buildProgressList() {
		const $list = $('#aisales-wizard-progress-list');
		$list.empty();

		wizardState.selectedTemplates.forEach(type => {
			const label = window.aisalesWizardData?.templates?.[type]?.label || type;
			$list.append(`
				<div class="aisales-wizard__progress-item" data-template-type="${type}">
					<span class="aisales-wizard__progress-icon">
						<span class="dashicons dashicons-marker"></span>
					</span>
					<span>${label}</span>
				</div>
			`);
		});
	}

	/**
	 * Generate a single template
	 */
	async function generateTemplate(templateType, index) {
		const $item = $(`.aisales-wizard__progress-item[data-template-type="${templateType}"]`);

		// Set as active
		$item.addClass('aisales-wizard__progress-item--active')
			.find('.aisales-wizard__progress-icon')
			.html('<span class="aisales-wizard__progress-spinner"></span>');

		try {
			const response = await $.ajax({
				url: aisalesWizard.ajaxUrl,
				type: 'POST',
				data: {
					action: 'aisales_generate_email_template',
					nonce: aisalesWizard.nonce,
					template_type: templateType,
				},
			});

			if (response.success) {
				wizardState.generatedTemplates.push({
					type: templateType,
					template: response.data.template,
				});

				// Update UI
				$item.removeClass('aisales-wizard__progress-item--active')
					.addClass('aisales-wizard__progress-item--completed')
					.find('.aisales-wizard__progress-icon')
					.html('<span class="dashicons dashicons-yes"></span>');

				// Update balance if returned
				if (response.data.balance !== undefined) {
					$('#aisales-balance-display').text(response.data.balance.toLocaleString());
				}
			} else {
				throw new Error(response.data?.message || 'Unknown error');
			}
		} catch (error) {
			wizardState.errors.push({
				type: templateType,
				error: error.message || 'Failed to generate',
			});

			$item.removeClass('aisales-wizard__progress-item--active')
				.addClass('aisales-wizard__progress-item--error')
				.find('.aisales-wizard__progress-icon')
				.html('<span class="dashicons dashicons-warning"></span>');
		}

		// Small delay between generations
		await new Promise(resolve => setTimeout(resolve, 300));
	}

	/**
	 * Show completion summary
	 */
	function showCompletionSummary() {
		const successCount = wizardState.generatedTemplates.length;
		const errorCount = wizardState.errors.length;

		$('#aisales-wizard-success-count').text(successCount);
		$('#aisales-wizard-error-count').text(errorCount);

		// Update the message
		if (errorCount > 0) {
			$('.aisales-wizard__complete h3').text(aisalesWizard.i18n.partialSuccess || 'Almost there!');
			$('.aisales-wizard__complete p').text(
				(aisalesWizard.i18n.partialSuccessMsg || '{success} templates generated, {errors} failed.')
					.replace('{success}', successCount)
					.replace('{errors}', errorCount)
			);
		}
	}

	/**
	 * Finish wizard and refresh page
	 */
	function finishWizard() {
		// Mark wizard as completed
		$.ajax({
			url: aisalesWizard.ajaxUrl,
			type: 'POST',
			data: {
				action: 'aisales_complete_email_wizard',
				nonce: aisalesWizard.nonce,
			},
		}).always(function () {
			// Refresh page to show new templates
			location.reload();
		});
	}

	/**
	 * Check if wizard should be shown (first time)
	 */
	function shouldShowWizard() {
		return window.aisalesWizardData?.showWizard === true;
	}

	// Public API
	window.aisalesEmailWizard = {
		open: openWizard,
		close: closeWizard,
		shouldShow: shouldShowWizard,
	};

	// Initialize when document is ready
	$(document).ready(init);

})(jQuery);
