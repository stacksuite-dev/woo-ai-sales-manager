/**
 * SEO Checker Page JavaScript
 *
 * Handles scan execution, results display, and fix functionality.
 *
 * @package AISales_Sales_Manager
 */

(function($) {
	'use strict';

	// State
	var state = {
		isScanning: false,
		currentIssue: null,
		generatedFix: null,
		scanResults: aisalesSeoChecker.scanResults || null
	};

	/**
	 * Initialize the SEO Checker page
	 */
	function init() {
		bindEvents();

		// Show results if we have them
		if (state.scanResults && state.scanResults.overall_score !== undefined) {
			updateScoreDisplay(state.scanResults);
		}
	}

	/**
	 * Bind event handlers
	 */
	function bindEvents() {
		// Run scan button
		$('#aisales-seo-run-scan-btn').on('click', runScan);

		// Accordion toggles
		$(document).on('click', '.aisales-seo-accordion__header', function() {
			var $accordion = $(this).closest('.aisales-seo-accordion');
			var $content = $accordion.find('.aisales-seo-accordion__content');
			var isExpanded = $(this).attr('aria-expanded') === 'true';

			$(this).attr('aria-expanded', !isExpanded);
			$content.slideToggle(200);
		});

		// Individual fix button
		$(document).on('click', '.aisales-seo-fix-btn', function(e) {
			e.stopPropagation();
			var issue = $(this).data('issue');
			openFixModal(issue);
		});

		// Bulk fix button
		$(document).on('click', '.aisales-seo-bulk-fix-btn', function(e) {
			e.stopPropagation();
			var category = $(this).data('category');
			openBulkFixModal(category);
		});

		// Modal close
		$('#aisales-seo-fix-modal-close, #aisales-seo-fix-cancel-btn').on('click', closeFixModal);
		$('.aisales-seo-modal__overlay').on('click', closeFixModal);

		// Generate fix button
		$('#aisales-seo-fix-generate-btn').on('click', generateFix);

		// Apply fix button
		$('#aisales-seo-fix-apply-btn').on('click', applyFix);

		// Filter changes
		$('#aisales-seo-filter-type, #aisales-seo-filter-priority').on('change', filterIssues);
	}

	/**
	 * Run SEO scan
	 */
	function runScan() {
		if (state.isScanning) {
			return;
		}

		state.isScanning = true;
		var $btn = $('#aisales-seo-run-scan-btn');
		var originalText = $btn.find('.aisales-seo-controls__btn-text').text();

		// Update button state
		$btn.prop('disabled', true);
		$btn.find('.aisales-seo-controls__btn-text').text(aisalesSeoChecker.i18n.scanning);
		$btn.find('.dashicons').removeClass('dashicons-search').addClass('dashicons-update spin');

		// Show progress bar
		$('#aisales-seo-progress').slideDown(200);
		$('#aisales-seo-empty-state').hide();

		// Get filter values
		var filterType = $('#aisales-seo-filter-type').val();
		var filterPriority = $('#aisales-seo-filter-priority').val();

		// Start scan via AJAX
		$.ajax({
			url: aisalesSeoChecker.ajaxUrl,
			type: 'POST',
			data: {
				action: 'aisales_seo_run_scan',
				nonce: aisalesSeoChecker.nonce,
				filter_type: filterType,
				filter_priority: filterPriority
			},
			success: function(response) {
				if (response.success) {
					state.scanResults = response.data.results;
					updateScoreDisplay(response.data.results);
					renderIssues(response.data.results);
					expandAccordionsWithIssues();
					showNotice(aisalesSeoChecker.i18n.scanComplete, 'success');
				} else {
					showNotice(response.data.message || aisalesSeoChecker.i18n.scanError, 'error');
				}
			},
			error: function() {
				showNotice(aisalesSeoChecker.i18n.scanError, 'error');
			},
			complete: function() {
				state.isScanning = false;
				$btn.prop('disabled', false);
				$btn.find('.aisales-seo-controls__btn-text').text(originalText);
				$btn.find('.dashicons').removeClass('dashicons-update spin').addClass('dashicons-search');
				$('#aisales-seo-progress').slideUp(200);
			}
		});

		// Simulate progress (actual progress will come from AJAX if backend supports it)
		simulateProgress();
	}

	/**
	 * Simulate scan progress animation
	 */
	function simulateProgress() {
		var progress = 0;
		var steps = [
			{ text: 'Scanning products...', progress: 20 },
			{ text: 'Scanning categories...', progress: 35 },
			{ text: 'Scanning pages...', progress: 50 },
			{ text: 'Scanning blog posts...', progress: 65 },
			{ text: 'Checking store settings...', progress: 80 },
			{ text: 'Analyzing homepage...', progress: 90 },
			{ text: 'Calculating scores...', progress: 100 }
		];
		var stepIndex = 0;

		var interval = setInterval(function() {
			if (!state.isScanning || stepIndex >= steps.length) {
				clearInterval(interval);
				return;
			}

			var step = steps[stepIndex];
			$('#aisales-seo-progress-fill').css('width', step.progress + '%');
			$('#aisales-seo-progress-text').text(step.text);
			stepIndex++;
		}, 800);
	}

	/**
	 * Update score display with scan results
	 */
	function updateScoreDisplay(results) {
		var score = results.overall_score || 0;
		var scoreClass = getScoreClass(score);
		var scoreLabel = getScoreLabel(score);
		var scannedCategories = results.scanned_categories || [];

		// Update gauge
		var $gauge = $('#aisales-seo-score-gauge');
		$gauge.removeClass('aisales-seo-score--excellent aisales-seo-score--good aisales-seo-score--warning aisales-seo-score--critical aisales-seo-score--not-scanned');

		// Check if any categories were scanned
		var hasScannedData = scannedCategories.length > 0;

		if (hasScannedData) {
			$gauge.addClass(scoreClass);
			$('#aisales-seo-score-number').text(score);
			$('#aisales-seo-score-label').text(scoreLabel);

			// Animate gauge progress
			var circumference = 339.292;
			var offset = circumference * (1 - score / 100);
			$gauge.find('.aisales-seo-score-gauge__progress').css('stroke-dashoffset', offset);
		} else {
			$gauge.addClass('aisales-seo-score--not-scanned');
			$('#aisales-seo-score-number').text('—');
			$('#aisales-seo-score-label').text('Not scanned');
			$gauge.find('.aisales-seo-score-gauge__progress').css('stroke-dashoffset', 339.292);
		}

		// Update category scores
		var scores = results.scores || {};
		$('.aisales-seo-score-breakdown__item').each(function() {
			var category = $(this).data('category');
			var catScore = scores[category] || 0;
			var wasScanned = scannedCategories.indexOf(category) !== -1;

			var $valueEl = $(this).find('.aisales-seo-score-breakdown__item-value');
			var $progressEl = $(this).find('.aisales-seo-score-breakdown__item-progress');

			$valueEl.removeClass('aisales-seo-score--excellent aisales-seo-score--good aisales-seo-score--warning aisales-seo-score--critical aisales-seo-score--not-scanned');
			$progressEl.removeClass('aisales-seo-score--excellent aisales-seo-score--good aisales-seo-score--warning aisales-seo-score--critical aisales-seo-score--not-scanned');

			if (wasScanned) {
				var catScoreClass = getScoreClass(catScore);
				$valueEl.text(catScore).addClass(catScoreClass);
				$progressEl.css('width', catScore + '%').addClass(catScoreClass);
			} else {
				$valueEl.text('—').addClass('aisales-seo-score--not-scanned');
				$progressEl.css('width', '0%').addClass('aisales-seo-score--not-scanned');
			}
		});

		// Update issues summary
		var issues = results.issues || {};
		$('#aisales-seo-critical-count').text(issues.critical || 0);
		$('#aisales-seo-warning-count').text(issues.warnings || 0);
		$('#aisales-seo-passed-count').text(issues.passed || 0);

		// Show issues summary if not visible
		if (!$('#aisales-seo-issues-summary').length && (issues.critical || issues.warnings || issues.passed)) {
			// Create and insert issues summary
			var summaryHtml = createIssuesSummaryHtml(issues);
			$('.aisales-seo-controls').after(summaryHtml);
		}

		// Update meta info
		if (results.scan_date && results.items_scanned) {
			var metaHtml = aisalesSeoChecker.i18n.lastScan || 'Last scan: ' + results.scan_date + ' · ' + results.items_scanned + ' items';
			$('.aisales-seo-controls__meta').text(metaHtml);
		}
	}

	/**
	 * Render issues in accordions
	 */
	function renderIssues(results) {
		var detailedIssues = results.detailed_issues || {};
		var scores = results.scores || {};
		var issues = results.issues || {};
		var categories = aisalesSeoChecker.categories || {};
		var scannedCategories = results.scanned_categories || [];

		// Remove empty state
		$('#aisales-seo-empty-state').remove();

		// Create issues summary if it doesn't exist
		if (!$('#aisales-seo-issues-summary').length) {
			var summaryHtml = createIssuesSummaryHtml(issues);
			$('.aisales-seo-controls').after(summaryHtml);
		}

		// Get the categories container
		var $categoriesContainer = $('#aisales-seo-categories');

		// Create accordions for all categories defined in settings
		Object.keys(categories).forEach(function(category) {
			var catIssues = detailedIssues[category] || [];
			var catScore = scores[category] || 0;
			var wasScanned = scannedCategories.indexOf(category) !== -1;
			var $accordion = $('.aisales-seo-accordion[data-category="' + category + '"]');

			if ($accordion.length) {
				// Update existing accordion
				updateAccordion($accordion, catIssues, catScore, wasScanned);
			} else {
				// Create new accordion
				var accordionHtml = createAccordionHtml(category, catIssues, catScore, wasScanned);
				if (accordionHtml) {
					$categoriesContainer.append(accordionHtml);
				}
			}
		});
	}

	/**
	 * Update accordion content
	 *
	 * @param {jQuery} $accordion  The accordion element.
	 * @param {Array}  issues      Array of issues for this category.
	 * @param {number} score       The category score.
	 * @param {boolean} wasScanned Whether this category was scanned.
	 */
	function updateAccordion($accordion, issues, score, wasScanned) {
		var category = $accordion.data('category');
		var criticalCount = 0;
		var warningCount = 0;

		issues.forEach(function(issue) {
			if (issue.severity === 'critical') criticalCount++;
			else if (issue.severity === 'warning') warningCount++;
		});

		// Update score badge
		var $scoreBadge = $accordion.find('.aisales-seo-accordion__score');
		$scoreBadge.removeClass('aisales-seo-score--excellent aisales-seo-score--good aisales-seo-score--warning aisales-seo-score--critical aisales-seo-score--not-scanned');

		if (wasScanned) {
			var scoreClass = getScoreClass(score);
			$scoreBadge.text(score + '/100').addClass(scoreClass);
		} else {
			$scoreBadge.text('—').addClass('aisales-seo-score--not-scanned');
		}

		// Update issue badges
		var $badges = $accordion.find('.aisales-seo-accordion__badge');
		$badges.remove();

		var $toggle = $accordion.find('.aisales-seo-accordion__toggle');
		if (wasScanned) {
			if (criticalCount > 0) {
				$('<span class="aisales-seo-accordion__badge aisales-seo-accordion__badge--critical">' + criticalCount + ' critical</span>').insertBefore($toggle);
			}
			if (warningCount > 0) {
				$('<span class="aisales-seo-accordion__badge aisales-seo-accordion__badge--warning">' + warningCount + ' warnings</span>').insertBefore($toggle);
			}
		} else {
			$('<span class="aisales-seo-accordion__badge aisales-seo-accordion__badge--not-scanned">Not scanned</span>').insertBefore($toggle);
		}

		// Update content
		var $content = $accordion.find('.aisales-seo-accordion__content');
		if (!wasScanned) {
			$content.html('<div class="aisales-seo-accordion__not-scanned"><span class="dashicons dashicons-info-outline"></span> <span>This category hasn\'t been scanned yet. Click <strong>"Run Scan"</strong> with the filter set to <strong>"All"</strong> or <strong>"' + getCategoryFilterLabel(category) + '"</strong> to analyze it.</span></div>');
		} else if (issues.length === 0) {
			$content.html('<div class="aisales-seo-accordion__empty"><span class="dashicons dashicons-yes-alt"></span> No issues found. Great job!</div>');
		} else {
			var contentHtml = '';
			if (criticalCount + warningCount > 1) {
				contentHtml += '<div class="aisales-seo-accordion__bulk-actions"><button type="button" class="aisales-btn aisales-btn--ghost aisales-btn--sm aisales-seo-bulk-fix-btn" data-category="' + category + '"><span class="dashicons dashicons-admin-customizer"></span> AI Fix All</button></div>';
			}
			contentHtml += '<div class="aisales-seo-issues-list">';
			issues.forEach(function(issue) {
				contentHtml += createIssueRowHtml(issue);
			});
			contentHtml += '</div>';
			$content.html(contentHtml);
		}
	}

	/**
	 * Get human-readable filter label for a category
	 */
	function getCategoryFilterLabel(category) {
		var labels = {
			'products': 'Products',
			'categories': 'Categories',
			'pages': 'Pages',
			'posts': 'Blog Posts',
			'store_settings': 'All',
			'homepage': 'All'
		};
		return labels[category] || 'All';
	}

	/**
	 * Create issue row HTML
	 */
	function createIssueRowHtml(issue) {
		var severityClass = 'aisales-seo-issue--' + (issue.severity || 'warning');
		var iconClass = issue.severity === 'critical' ? 'dashicons-warning' : 'dashicons-info';

		var html = '<div class="aisales-seo-issue ' + severityClass + '" data-issue-id="' + (issue.id || '') + '" data-item-type="' + (issue.item_type || '') + '" data-item-id="' + (issue.item_id || '') + '">';
		html += '<div class="aisales-seo-issue__indicator"><span class="dashicons ' + iconClass + '"></span></div>';
		html += '<div class="aisales-seo-issue__content">';
		html += '<span class="aisales-seo-issue__title">' + escapeHtml(issue.title || '') + '</span>';
		if (issue.item_name) {
			html += '<span class="aisales-seo-issue__item-name">' + escapeHtml(issue.item_name) + '</span>';
		}
		if (issue.description) {
			html += '<span class="aisales-seo-issue__description">' + escapeHtml(issue.description) + '</span>';
		}
		html += '</div>';
		html += '<div class="aisales-seo-issue__actions">';
		if (issue.fixable) {
			html += '<button type="button" class="aisales-btn aisales-btn--pill aisales-btn--sm aisales-seo-fix-btn" data-issue=\'' + JSON.stringify(issue).replace(/'/g, '&#39;') + '\'><span class="dashicons dashicons-admin-customizer"></span> AI Fix</button>';
		}
		if (issue.edit_url) {
			html += '<a href="' + escapeHtml(issue.edit_url) + '" class="aisales-btn aisales-btn--ghost aisales-btn--sm" target="_blank"><span class="dashicons dashicons-edit"></span> Edit</a>';
		}
		html += '</div></div>';

		return html;
	}

	/**
	 * Open fix modal for single issue
	 */
	function openFixModal(issue) {
		state.currentIssue = issue;
		state.generatedFix = null;

		// Reset modal state
		$('#aisales-seo-fix-details').show();
		$('#aisales-seo-fix-preview').hide();
		$('#aisales-seo-fix-loading').hide();
		$('#aisales-seo-fix-error').hide();
		$('#aisales-seo-fix-generate-btn').show();
		$('#aisales-seo-fix-apply-btn').hide();
		$('#aisales-seo-fix-cost').hide();

		// Populate modal
		$('#aisales-seo-fix-modal-title').text(aisalesSeoChecker.i18n.fixModalTitle);
		$('#aisales-seo-fix-item-name').text(issue.item_name || '');
		$('#aisales-seo-fix-issue-title').text(issue.title || '');
		$('#aisales-seo-fix-current').text(issue.current_value || 'N/A');

		// Show modal
		$('#aisales-seo-fix-modal').fadeIn(200);
		$('body').addClass('aisales-modal-open');
	}

	/**
	 * Open bulk fix modal
	 */
	function openBulkFixModal(category) {
		// Get all fixable issues for this category
		var issues = [];
		$('.aisales-seo-accordion[data-category="' + category + '"] .aisales-seo-fix-btn').each(function() {
			issues.push($(this).data('issue'));
		});

		if (issues.length === 0) {
			showNotice('No fixable issues found.', 'warning');
			return;
		}

		// For now, open modal for first issue (TODO: implement bulk fix UI)
		openFixModal(issues[0]);
		$('#aisales-seo-fix-modal-title').text(aisalesSeoChecker.i18n.bulkFixModalTitle + ' (' + issues.length + ' issues)');
	}

	/**
	 * Close fix modal
	 */
	function closeFixModal() {
		$('#aisales-seo-fix-modal').fadeOut(200);
		$('body').removeClass('aisales-modal-open');
		state.currentIssue = null;
		state.generatedFix = null;
	}

	/**
	 * Generate AI fix for current issue
	 */
	function generateFix() {
		if (!state.currentIssue) {
			return;
		}

		var $btn = $('#aisales-seo-fix-generate-btn');
		$btn.prop('disabled', true);
		$btn.html('<span class="dashicons dashicons-update spin"></span> ' + aisalesSeoChecker.i18n.generating);

		$('#aisales-seo-fix-loading').show();
		$('#aisales-seo-fix-loading-text').text(aisalesSeoChecker.i18n.generating);

		$.ajax({
			url: aisalesSeoChecker.ajaxUrl,
			type: 'POST',
			data: {
				action: 'aisales_seo_generate_fix',
				nonce: aisalesSeoChecker.nonce,
				issue: JSON.stringify(state.currentIssue)
			},
			success: function(response) {
				if (response.success) {
					state.generatedFix = response.data.fix;

					// Show preview
					$('#aisales-seo-fix-preview-content').text(response.data.fix.suggested_value || '');
					$('#aisales-seo-fix-preview').show();
					$('#aisales-seo-fix-loading').hide();
					$('#aisales-seo-fix-error').hide();

					// Update buttons
					$btn.hide();
					$('#aisales-seo-fix-apply-btn').show();

					// Show cost
					if (response.data.tokens_used) {
						$('#aisales-seo-fix-cost-value').text(response.data.tokens_used);
						$('#aisales-seo-fix-cost').show();
					}

					// Update balance
					if (response.data.new_balance !== undefined) {
						updateBalance(response.data.new_balance);
					}
				} else {
					showModalError(response.data.message || 'Failed to generate fix.');
				}
			},
			error: function() {
				showModalError('Failed to generate fix. Please try again.');
			},
			complete: function() {
				$btn.prop('disabled', false);
				$btn.html('<span class="dashicons dashicons-admin-customizer"></span> ' + aisalesSeoChecker.i18n.previewFix);
			}
		});
	}

	/**
	 * Apply generated fix
	 */
	function applyFix() {
		if (!state.currentIssue || !state.generatedFix) {
			return;
		}

		// Save reference to issue before closing modal
		var fixedIssue = state.currentIssue;
		var $btn = $('#aisales-seo-fix-apply-btn');
		$btn.prop('disabled', true);
		$btn.html('<span class="dashicons dashicons-update spin"></span> ' + aisalesSeoChecker.i18n.applying);

		$.ajax({
			url: aisalesSeoChecker.ajaxUrl,
			type: 'POST',
			data: {
				action: 'aisales_seo_apply_fix',
				nonce: aisalesSeoChecker.nonce,
				issue: JSON.stringify(state.currentIssue),
				fix: JSON.stringify(state.generatedFix)
			},
			success: function(response) {
				if (response.success) {
					closeFixModal();

					// Find and remove the fixed issue from the list
					var $issueRow = $('.aisales-seo-issue[data-issue-id="' + fixedIssue.id + '"]');
					var $accordion = $issueRow.closest('.aisales-seo-accordion');
					var severity = fixedIssue.severity || 'warning';

					$issueRow.fadeOut(300, function() {
						$(this).remove();

						// Update accordion after issue is removed
						updateAccordionAfterFix($accordion, severity);

						// Update global issue counts
						updateIssueSummaryCounts(severity);

						// Show success notice after UI updates
						showNotice(aisalesSeoChecker.i18n.fixed, 'success');
					});
				} else {
					showNotice(response.data.message || 'Failed to apply fix.', 'error');
				}
			},
			error: function() {
				showNotice('Failed to apply fix. Please try again.', 'error');
			},
			complete: function() {
				$btn.prop('disabled', false);
				$btn.html('<span class="dashicons dashicons-yes"></span> ' + aisalesSeoChecker.i18n.applyFix);
			}
		});
	}

	/**
	 * Update accordion header badges after a fix is applied
	 */
	function updateAccordionAfterFix($accordion, fixedSeverity) {
		// Count remaining issues
		var $issues = $accordion.find('.aisales-seo-issue');
		var criticalCount = $issues.filter('.aisales-seo-issue--critical').length;
		var warningCount = $issues.filter('.aisales-seo-issue--warning').length;
		var totalIssues = criticalCount + warningCount;

		// Update badges
		var $header = $accordion.find('.aisales-seo-accordion__header');
		$header.find('.aisales-seo-accordion__badge').remove();

		var $toggle = $header.find('.aisales-seo-accordion__toggle');
		if (criticalCount > 0) {
			$('<span class="aisales-seo-accordion__badge aisales-seo-accordion__badge--critical">' + criticalCount + ' critical</span>').insertBefore($toggle);
		}
		if (warningCount > 0) {
			$('<span class="aisales-seo-accordion__badge aisales-seo-accordion__badge--warning">' + warningCount + ' warnings</span>').insertBefore($toggle);
		}

		// If no issues left, show success message and hide bulk fix button
		if (totalIssues === 0) {
			var $content = $accordion.find('.aisales-seo-accordion__content');
			$content.find('.aisales-seo-accordion__bulk-actions').remove();
			$content.find('.aisales-seo-issues-list').remove();
			$content.html('<div class="aisales-seo-accordion__empty aisales-seo-accordion__empty--fixed"><span class="dashicons dashicons-yes-alt"></span> ' + aisalesSeoChecker.i18n.allFixed + '</div>');

			// Update score badge to excellent (assuming all issues fixed means good score)
			var $scoreBadge = $header.find('.aisales-seo-accordion__score');
			$scoreBadge.removeClass('aisales-seo-score--critical aisales-seo-score--warning aisales-seo-score--good')
				.addClass('aisales-seo-score--excellent');
		} else if (totalIssues === 1) {
			// Remove bulk fix button if only 1 issue remains
			$accordion.find('.aisales-seo-accordion__bulk-actions').remove();
		}
	}

	/**
	 * Update the issues summary bar counts
	 */
	function updateIssueSummaryCounts(fixedSeverity) {
		var $summary = $('#aisales-seo-issues-summary');
		if (!$summary.length) return;

		// Decrement the appropriate count
		if (fixedSeverity === 'critical') {
			var $criticalCount = $('#aisales-seo-critical-count');
			var newCount = Math.max(0, parseInt($criticalCount.text(), 10) - 1);
			$criticalCount.text(newCount);
		} else {
			var $warningCount = $('#aisales-seo-warning-count');
			var newCount = Math.max(0, parseInt($warningCount.text(), 10) - 1);
			$warningCount.text(newCount);
		}

		// Increment passed count
		var $passedCount = $('#aisales-seo-passed-count');
		var newPassedCount = parseInt($passedCount.text(), 10) + 1;
		$passedCount.text(newPassedCount);
	}

	/**
	 * Filter issues based on dropdown selections
	 */
	function filterIssues() {
		var filterType = $('#aisales-seo-filter-type').val();
		var filterPriority = $('#aisales-seo-filter-priority').val();

		// Show/hide accordions based on filter
		$('.aisales-seo-accordion').each(function() {
			var category = $(this).data('category');
			if (filterType === 'all' || filterType === category) {
				$(this).show();
			} else {
				$(this).hide();
			}
		});

		// Sort issues if needed (TODO: implement sorting)
	}

	/**
	 * Expand accordions that have issues after scan
	 * Prioritizes critical issues, then warnings
	 */
	function expandAccordionsWithIssues() {
		var expandedCount = 0;
		var maxExpanded = 3; // Limit to avoid overwhelming the user

		// First pass: expand accordions with critical issues
		$('.aisales-seo-accordion').each(function() {
			if (expandedCount >= maxExpanded) {
				return false; // Break the loop
			}

			var $accordion = $(this);
			var hasCritical = $accordion.find('.aisales-seo-accordion__badge--critical').length > 0;

			if (hasCritical) {
				expandAccordion($accordion);
				expandedCount++;
			}
		});

		// Second pass: expand accordions with warnings if we haven't reached max
		if (expandedCount < maxExpanded) {
			$('.aisales-seo-accordion').each(function() {
				if (expandedCount >= maxExpanded) {
					return false;
				}

				var $accordion = $(this);
				var hasWarnings = $accordion.find('.aisales-seo-accordion__badge--warning').length > 0;
				var isExpanded = $accordion.find('.aisales-seo-accordion__header').attr('aria-expanded') === 'true';

				if (hasWarnings && !isExpanded) {
					expandAccordion($accordion);
					expandedCount++;
				}
			});
		}

		// If no issues found, expand the first accordion to show "Great job!" message
		if (expandedCount === 0) {
			var $firstAccordion = $('.aisales-seo-accordion').first();
			if ($firstAccordion.length) {
				expandAccordion($firstAccordion);
			}
		}
	}

	/**
	 * Expand a single accordion
	 */
	function expandAccordion($accordion) {
		var $header = $accordion.find('.aisales-seo-accordion__header');
		var $content = $accordion.find('.aisales-seo-accordion__content');

		$header.attr('aria-expanded', 'true');
		$content.slideDown(200);
	}

	/**
	 * Collapse a single accordion
	 */
	function collapseAccordion($accordion) {
		var $header = $accordion.find('.aisales-seo-accordion__header');
		var $content = $accordion.find('.aisales-seo-accordion__content');

		$header.attr('aria-expanded', 'false');
		$content.slideUp(200);
	}

	/**
	 * Get score class based on value
	 */
	function getScoreClass(score) {
		if (score >= 90) return 'aisales-seo-score--excellent';
		if (score >= 70) return 'aisales-seo-score--good';
		if (score >= 50) return 'aisales-seo-score--warning';
		return 'aisales-seo-score--critical';
	}

	/**
	 * Get score label based on value
	 */
	function getScoreLabel(score) {
		if (score >= 90) return aisalesSeoChecker.i18n.excellent;
		if (score >= 70) return aisalesSeoChecker.i18n.good;
		if (score >= 50) return aisalesSeoChecker.i18n.needsWork;
		return aisalesSeoChecker.i18n.critical;
	}

	/**
	 * Update balance display
	 */
	function updateBalance(newBalance) {
		$('#aisales-balance-display').text(newBalance);
		aisalesSeoChecker.balance = newBalance;
	}

	/**
	 * Show error message inside the fix modal
	 */
	function showModalError(message) {
		$('#aisales-seo-fix-loading').hide();

		var $error = $('#aisales-seo-fix-error');
		if ($error.length === 0) {
			// Create error element if it doesn't exist
			$error = $('<div id="aisales-seo-fix-error" class="aisales-seo-fix-error"></div>');
			$('#aisales-seo-fix-details').after($error);
		}

		$error.html('<span class="dashicons dashicons-warning"></span> ' + escapeHtml(message)).show();

		// Reset button state
		var $btn = $('#aisales-seo-fix-generate-btn');
		$btn.prop('disabled', false);
		$btn.html('<span class="dashicons dashicons-admin-customizer"></span> ' + aisalesSeoChecker.i18n.previewFix);
	}

	/**
	 * Show admin notice
	 */
	function showNotice(message, type) {
		var $notice = $('<div class="notice notice-' + type + ' is-dismissible"><p>' + escapeHtml(message) + '</p></div>');
		$('.aisales-notices-anchor').after($notice);

		// Auto-dismiss after 5 seconds
		setTimeout(function() {
			$notice.fadeOut(300, function() {
				$(this).remove();
			});
		}, 5000);
	}

	/**
	 * Escape HTML for safe output
	 */
	function escapeHtml(text) {
		if (!text) return '';
		var div = document.createElement('div');
		div.textContent = text;
		return div.innerHTML;
	}

	/**
	 * Create issues summary HTML
	 */
	function createIssuesSummaryHtml(issues) {
		return '<div class="aisales-seo-issues-summary" id="aisales-seo-issues-summary">' +
			'<div class="aisales-seo-issues-summary__item aisales-seo-issues-summary__item--critical">' +
			'<span class="aisales-seo-issues-summary__icon"><span class="dashicons dashicons-warning"></span></span>' +
			'<span class="aisales-seo-issues-summary__count" id="aisales-seo-critical-count">' + (issues.critical || 0) + '</span>' +
			'<span class="aisales-seo-issues-summary__label">Critical</span>' +
			'</div>' +
			'<div class="aisales-seo-issues-summary__item aisales-seo-issues-summary__item--warning">' +
			'<span class="aisales-seo-issues-summary__icon"><span class="dashicons dashicons-info"></span></span>' +
			'<span class="aisales-seo-issues-summary__count" id="aisales-seo-warning-count">' + (issues.warnings || 0) + '</span>' +
			'<span class="aisales-seo-issues-summary__label">Warnings</span>' +
			'</div>' +
			'<div class="aisales-seo-issues-summary__item aisales-seo-issues-summary__item--passed">' +
			'<span class="aisales-seo-issues-summary__icon"><span class="dashicons dashicons-yes-alt"></span></span>' +
			'<span class="aisales-seo-issues-summary__count" id="aisales-seo-passed-count">' + (issues.passed || 0) + '</span>' +
			'<span class="aisales-seo-issues-summary__label">Passed</span>' +
			'</div>' +
			'</div>';
	}

	/**
	 * Create accordion HTML
	 *
	 * @param {string}  category   The category key.
	 * @param {Array}   issues     Array of issues for this category.
	 * @param {number}  score      The category score.
	 * @param {boolean} wasScanned Whether this category was scanned.
	 */
	function createAccordionHtml(category, issues, score, wasScanned) {
		var categoryDef = aisalesSeoChecker.categories[category];
		if (!categoryDef) {
			return '';
		}

		var criticalCount = 0;
		var warningCount = 0;

		issues.forEach(function(issue) {
			if (issue.severity === 'critical') criticalCount++;
			else if (issue.severity === 'warning') warningCount++;
		});

		var html = '<div class="aisales-seo-accordion" data-category="' + category + '">';
		html += '<button type="button" class="aisales-seo-accordion__header" aria-expanded="false">';
		html += '<span class="aisales-seo-accordion__icon"><span class="dashicons ' + categoryDef.icon + '"></span></span>';
		html += '<span class="aisales-seo-accordion__title">' + escapeHtml(categoryDef.label) + '</span>';

		// Score badge - show dash for unscanned, actual score for scanned
		if (wasScanned) {
			var scoreClass = getScoreClass(score);
			html += '<span class="aisales-seo-accordion__score ' + scoreClass + '">' + score + '/100</span>';
		} else {
			html += '<span class="aisales-seo-accordion__score aisales-seo-score--not-scanned">—</span>';
		}

		// Issue badges
		if (wasScanned) {
			if (criticalCount > 0) {
				html += '<span class="aisales-seo-accordion__badge aisales-seo-accordion__badge--critical">' + criticalCount + ' critical</span>';
			}
			if (warningCount > 0) {
				html += '<span class="aisales-seo-accordion__badge aisales-seo-accordion__badge--warning">' + warningCount + ' warnings</span>';
			}
		} else {
			html += '<span class="aisales-seo-accordion__badge aisales-seo-accordion__badge--not-scanned">Not scanned</span>';
		}

		html += '<span class="aisales-seo-accordion__toggle"><span class="dashicons dashicons-arrow-down-alt2"></span></span>';
		html += '</button>';
		html += '<div class="aisales-seo-accordion__content" style="display: none;">';

		// Content based on scan state
		if (!wasScanned) {
			html += '<div class="aisales-seo-accordion__not-scanned"><span class="dashicons dashicons-info-outline"></span> <span>This category hasn\'t been scanned yet. Click <strong>"Run Scan"</strong> with the filter set to <strong>"All"</strong> or <strong>"' + getCategoryFilterLabel(category) + '"</strong> to analyze it.</span></div>';
		} else if (issues.length === 0) {
			html += '<div class="aisales-seo-accordion__empty"><span class="dashicons dashicons-yes-alt"></span> No issues found. Great job!</div>';
		} else {
			if (criticalCount + warningCount > 1) {
				html += '<div class="aisales-seo-accordion__bulk-actions"><button type="button" class="aisales-btn aisales-btn--ghost aisales-btn--sm aisales-seo-bulk-fix-btn" data-category="' + category + '"><span class="dashicons dashicons-admin-customizer"></span> AI Fix All</button></div>';
			}
			html += '<div class="aisales-seo-issues-list">';
			issues.forEach(function(issue) {
				html += createIssueRowHtml(issue);
			});
			html += '</div>';
		}

		html += '</div></div>';

		return html;
	}

	// Initialize on DOM ready
	$(document).ready(init);

})(jQuery);
