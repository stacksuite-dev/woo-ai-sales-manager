/**
 * Support Modal UI
 */
(function($) {
	'use strict';

	var SupportModal = {
		init: function() {
			this.cache();
			this.bind();
		},

		cache: function() {
			this.$body = $('body');
			this.$overlay = $('#aisales-support-modal-overlay');
			this.$modal = $('#aisales-support-modal');
			this.$openers = $('[data-aisales-support-trigger]');
			this.$close = $('#aisales-support-modal-close');
			this.$back = $('#aisales-support-back');
			this.$next = $('#aisales-support-next');
			this.$tabs = $('.aisales-support-step-tab');
			this.$panels = $('.aisales-support-step-panel');
			this.$title = $('#aisales-support-draft-title');
			this.$description = $('#aisales-support-draft-description');
			this.$chips = $('.aisales-support-chip-group');
			this.$clarifyList = $('.aisales-support-clarify');
			this.$reviewBox = $('.aisales-support-review__box');
			this.$reviewMeta = $('.aisales-support-review__meta');
			this.$reviewSummary = $('.aisales-support-review__summary-text');
			this.$upload = $('.aisales-support-upload');
			this.$uploadInput = $('#aisales-support-upload-input');
			this.$attachmentList = $('.aisales-support-attachment-list');
			this.$info = $('.aisales-modal__info');
			this.steps = ['draft', 'clarify', 'review'];
			this.stepIndex = 0;
			this.draftId = null;
			this.category = 'support';
			this.analysis = null;
			this.attachments = [];
		},

		bind: function() {
			var self = this;
			if (!this.$modal.length) {
				return;
			}

			this.$openers.on('click', function() {
				self.open();
			});

			this.$close.on('click', function() {
				self.close();
			});

			this.$overlay.on('click', function() {
				self.close();
			});

			$(document).on('keydown', function(event) {
				if (event.key === 'Escape') {
					self.close();
				}
			});

			this.$next.on('click', function() {
				if (self.steps[self.stepIndex] === 'review') {
					self.submitTicket();
					return;
				}
				self.goTo(self.stepIndex + 1);
			});

			this.$back.on('click', function() {
				self.goTo(self.stepIndex - 1);
			});

			this.$tabs.on('click', function() {
				self.goTo(self.steps.indexOf($(this).data('step')));
			});

			this.$chips.on('click', '.aisales-support-chip', function() {
				$(this).addClass('is-selected').siblings().removeClass('is-selected');
				self.category = $(this).text().toLowerCase();
			});

			this.$upload.on('click', function() {
				self.$uploadInput.trigger('click');
			});

			this.$uploadInput.on('change', function(event) {
				self.handleFiles(event.target.files || []);
				$(this).val('');
			});
		},

		open: function() {
			this.$overlay.addClass('aisales-modal-overlay--active');
			this.$modal.addClass('aisales-modal--active');
			this.$body.addClass('aisales-modal-open');
			this.goTo(0);
			this.$next.prop('disabled', false);
		},

		close: function() {
			this.$overlay.removeClass('aisales-modal-overlay--active');
			this.$modal.removeClass('aisales-modal--active');
			this.$body.removeClass('aisales-modal-open');
			this.reset();
		},

		reset: function() {
			this.draftId = null;
			this.category = 'support';
			this.analysis = null;
			this.attachments = [];
			this.$title.val('');
			this.$description.val('');
			this.$chips.find('.aisales-support-chip').removeClass('is-selected');
			this.$chips.find('.aisales-support-chip').first().addClass('is-selected');
			this.$clarifyList.html('');
			this.$reviewBox.html('');
			this.$reviewMeta.find('.aisales-status-badge--active').html('<span class="dashicons dashicons-tag"></span>Support');
			this.$reviewMeta.find('.aisales-status-badge--warning').html('<span class="dashicons dashicons-warning"></span>Normal');
			this.$reviewSummary.text('...');
			this.renderAttachments();
		},

		goTo: function(index) {
			if (index < 0 || index >= this.steps.length) {
				return;
			}

			if (index > this.stepIndex) {
				if (this.steps[this.stepIndex] === 'draft') {
					this.submitDraft();
					return;
				}

				if (this.steps[this.stepIndex] === 'clarify') {
					this.submitClarify();
					return;
				}
			}

			this.setStep(index);
		},

		setStep: function(index) {
			this.stepIndex = index;
			var step = this.steps[index];

			this.$tabs.removeClass('is-active');
			this.$tabs.filter('[data-step="' + step + '"]').addClass('is-active');

			this.$panels.removeClass('is-active');
			this.$panels.filter('[data-step="' + step + '"]').addClass('is-active');

			this.$back.prop('disabled', index === 0);
			this.$next.text(index === this.steps.length - 1 ? 'Submit' : 'Next');
			this.$info.text(index === 0 ? 'AI will ask follow-ups if needed.' : '');
		},

		submitDraft: function() {
			var self = this;
			var title = this.$title.val();
			var description = this.$description.val();

			if (!title || !description) {
				alert('Please enter a title and description.');
				return;
			}

			this.$next.prop('disabled', true).text('Analyzing...');

			$.post(aisalesAdmin.ajaxUrl, {
				action: 'aisales_support_draft',
				nonce: aisalesAdmin.nonce,
				title: title,
				description: description,
				category: this.category,
				attachments: JSON.stringify(this.attachments)
			}).done(function(response) {
				if (!response.success) {
					self.showError(self.getErrorMessage(response, 'Failed to analyze.'));
					return;
				}

				self.draftId = response.data.draft_id;
				self.analysis = {
					summary: response.data.summary || '',
					category: response.data.category || self.category,
					priority: response.data.priority || 'normal'
				};
				self.renderClarify(response.data.questions || []);
				self.renderReview();
				self.setStep(1);
			}).fail(function() {
				self.showError('Failed to analyze.');
			}).always(function() {
				self.$next.prop('disabled', false).text('Next');
			});
		},

		renderClarify: function(questions) {
			var html = '<h4>Clarifying Questions</h4>';
			if (!questions.length) {
				html += '<p>No additional questions.</p>';
			}

			questions.forEach(function(question, index) {
				html += '<div class="aisales-support-clarify__item">';
				html += '<label>' + question + '</label>';
				html += '<input type="text" class="aisales-form-input" data-question-index="' + index + '" placeholder="Your answer">';
				html += '</div>';
			});

			this.$clarifyList.html(html);
		},

		collectAnswers: function() {
			var answers = [];
			this.$clarifyList.find('input[data-question-index]').each(function() {
				answers.push($(this).val());
			});
			return answers;
		},

			handleFiles: function(files) {
			var self = this;
			var maxFiles = 5;
			var maxSize = 7 * 1024 * 1024;

			Array.prototype.forEach.call(files, function(file) {
				if (self.attachments.length >= maxFiles) {
					self.showError('You can upload up to 5 files.');
					return;
				}
				if (file.size > maxSize) {
					self.showError('File exceeds 7MB limit: ' + file.name);
					return;
				}
				self.uploadAttachment(file);
			});
		},

		uploadAttachment: function(file) {
			var self = this;
			var formData = new FormData();
			formData.append('action', 'aisales_support_upload');
			formData.append('nonce', aisalesAdmin.nonce);
			formData.append('attachment', file, file.name);

			$.ajax({
				url: aisalesAdmin.ajaxUrl,
				type: 'POST',
				data: formData,
				processData: false,
				contentType: false
			}).done(function(response) {
				if (!response.success) {
					self.showError(self.getErrorMessage(response, 'Failed to upload file.'));
					return;
				}

				self.attachments.push({
					filename: response.data.filename,
					mime_type: response.data.mime_type,
					url: response.data.url,
					size_bytes: response.data.size
				});
				self.renderAttachments();
			}).fail(function() {
				self.showError('Failed to upload file.');
			});
		},

			renderAttachments: function() {
				var html = '';
				if (!this.attachments.length) {
					this.$attachmentList.html('');
					return;
				}
				this.attachments.forEach(function(file) {
					html += '<span class="aisales-support-attachment-item">';
					html += '<span class="dashicons dashicons-media-default"></span>';
					html += file.filename;
					html += '</span>';
				});
				this.$attachmentList.html(html);
			},

		submitClarify: function() {
			var self = this;
			if (!this.draftId) {
				this.goTo(2);
				return;
			}

			this.$next.prop('disabled', true).text('Checking...');

			$.post(aisalesAdmin.ajaxUrl, {
				action: 'aisales_support_clarify',
				nonce: aisalesAdmin.nonce,
				draft_id: this.draftId,
				answers: this.collectAnswers()
			}).done(function(response) {
				if (!response.success) {
					self.showError(self.getErrorMessage(response, 'Failed to clarify.'));
					return;
				}

				if (response.data.ready_to_submit) {
					self.analysis = {
						summary: response.data.summary || (self.analysis ? self.analysis.summary : ''),
						category: response.data.category || (self.analysis ? self.analysis.category : self.category),
						priority: response.data.priority || (self.analysis ? self.analysis.priority : 'normal')
					};
					self.renderReview();
					self.setStep(2);
					return;
				}

				self.renderClarify(response.data.questions || []);
			}).fail(function() {
				self.showError('Failed to clarify.');
			}).always(function() {
				self.$next.prop('disabled', false).text('Next');
			});
		},

		renderReview: function() {
			var title = this.$title.val();
			var description = this.$description.val();
			var category = this.analysis && this.analysis.category ? this.analysis.category : this.category;
			var priority = this.analysis && this.analysis.priority ? this.analysis.priority : 'normal';
			var summary = this.analysis && this.analysis.summary ? this.analysis.summary : '—';
			this.$reviewBox.html('<strong>' + title + '</strong><p>' + description + '</p>');
			this.$reviewMeta.find('.aisales-status-badge--active').html('<span class="dashicons dashicons-tag"></span>' + category.charAt(0).toUpperCase() + category.slice(1));
			this.$reviewMeta.find('.aisales-status-badge--warning').html('<span class="dashicons dashicons-warning"></span>' + priority.charAt(0).toUpperCase() + priority.slice(1));
			this.$reviewSummary.text(summary);
		},

		submitTicket: function() {
			var self = this;
			if (!this.draftId) {
				self.showError('Missing draft.');
				return;
			}

			this.$next.prop('disabled', true).text('Submitting...');
			$.post(aisalesAdmin.ajaxUrl, {
				action: 'aisales_support_submit',
				nonce: aisalesAdmin.nonce,
				draft_id: this.draftId
			}).done(function(response) {
				if (!response.success) {
					self.showError(self.getErrorMessage(response, 'Failed to submit.'));
					return;
				}
				self.close();
				if (window.aisalesAdmin && aisalesAdmin.toast) {
					return;
				}
				self.showSuccess('Support ticket submitted.');
			}).fail(function() {
				self.showError('Failed to submit.');
			}).always(function() {
				self.$next.prop('disabled', false).text('Submit');
			});
		},

		getErrorMessage: function(response, fallback) {
			if (response && response.data && response.data.message) {
				return response.data.message;
			}

			return fallback;
		},

		showError: function(message) {
			if (window.AISales && typeof window.AISales.showRichToast === 'function') {
				window.AISales.showRichToast({
					type: 'error',
					icon: 'dashicons-warning',
					title: 'Support',
					message: message,
					duration: 4000
				});
				return;
			}
			alert(message);
		},

		showSuccess: function(message) {
			if (window.AISales && typeof window.AISales.showRichToast === 'function') {
				window.AISales.showRichToast({
					type: 'success',
					icon: 'dashicons-yes-alt',
					title: 'Support',
					message: message,
					duration: 3000
				});
				return;
			}
			alert(message);
		}
	};

	$(function() {
		SupportModal.init();
	});
})(jQuery);
