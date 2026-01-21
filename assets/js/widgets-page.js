/**
 * AI Sales Widgets Page JavaScript
 * 
 * Handles tab switching, copy functionality, modals, and settings.
 * @package AISales_Sales_Manager
 */

(function($) {
    'use strict';

    const WidgetsPage = {
        /**
         * Initialize
         */
        init: function() {
            this.bindEvents();
            this.initTooltips();
        },

        /**
         * Bind all event handlers
         */
        bindEvents: function() {
            // Tab switching
            $(document).on('click', '.aisales-widgets-tab', this.handleTabClick.bind(this));
            
            // Copy shortcode
            $(document).on('click', '.aisales-widget-card__copy-btn', this.handleCopyClick.bind(this));
            $(document).on('click', '#builder-copy', this.handleBuilderCopy.bind(this));
            
            // Toggle widget enabled state
            $(document).on('change', '.aisales-widget-card .aisales-toggle-switch input', this.handleToggle.bind(this));
            
            // Builder modal
            $(document).on('click', '.aisales-widget-card__builder-btn', this.openBuilder.bind(this));
            $(document).on('click', '#builder-modal-close, #builder-modal-overlay', this.closeBuilder.bind(this));
            $(document).on('click', '#builder-modal', function(e) { e.stopPropagation(); });
            
            // Docs modal
            $(document).on('click', '.aisales-widget-card__docs-btn', this.openDocs.bind(this));
            $(document).on('click', '#docs-modal-close, #docs-modal-overlay', this.closeDocs.bind(this));
            $(document).on('click', '#docs-modal', function(e) { e.stopPropagation(); });
            
            // Settings
            $(document).on('click', '#save-settings', this.saveSettings.bind(this));
            $(document).on('change', 'input[name="styling_mode"]', this.toggleColorSettings.bind(this));
            $(document).on('input', 'input[name="social_proof[popup_duration]"]', this.updateDurationDisplay.bind(this));
            
            // Builder form changes
            $(document).on('change input', '#builder-form input, #builder-form select', this.updateBuilderShortcode.bind(this));
            
            // Close modals on escape
            $(document).on('keydown', function(e) {
                if (e.key === 'Escape') {
                    this.closeBuilder();
                    this.closeDocs();
                }
            }.bind(this));
        },

        /**
         * Handle tab click
         */
        handleTabClick: function(e) {
            const $tab = $(e.currentTarget);
            const category = $tab.data('category');
            
            // Update active tab
            $('.aisales-widgets-tab').removeClass('aisales-widgets-tab--active');
            $tab.addClass('aisales-widgets-tab--active');
            
            // Show/hide content
            if (category === 'settings') {
                $('#widgets-grid').hide();
                $('#widgets-settings').show();
            } else {
                $('#widgets-settings').hide();
                $('#widgets-grid').show();
                
                // Filter cards
                if (category === 'all') {
                    $('.aisales-widget-card').removeClass('hidden');
                } else {
                    $('.aisales-widget-card').each(function() {
                        const cardCategory = $(this).data('category');
                        $(this).toggleClass('hidden', cardCategory !== category);
                    });
                }
            }
        },

        /**
         * Handle copy shortcode click
         */
        handleCopyClick: function(e) {
            const $btn = $(e.currentTarget);
            const shortcode = $btn.data('shortcode');
            
            this.copyToClipboard(shortcode, $btn);
        },

        /**
         * Handle builder copy
         */
        handleBuilderCopy: function(e) {
            const $btn = $(e.currentTarget);
            const shortcode = $('#builder-shortcode').text();
            
            this.copyToClipboard(shortcode, $btn);
        },

        /**
         * Copy text to clipboard
         */
        copyToClipboard: function(text, $btn) {
            navigator.clipboard.writeText(text).then(function() {
                // Show success feedback
                const $icon = $btn.find('.dashicons');
                const originalClass = $icon.attr('class');
                
                $icon.attr('class', 'dashicons dashicons-yes');
                $btn.addClass('copied');
                
                setTimeout(function() {
                    $icon.attr('class', originalClass);
                    $btn.removeClass('copied');
                }, 1500);
            });
        },

        /**
         * Handle widget toggle (only for feature-type widgets)
         */
        handleToggle: function(e) {
            const $input = $(e.currentTarget);
            const $card = $input.closest('.aisales-widget-card');
            
            // Only handle toggles for feature-type widgets
            if ($card.data('type') !== 'feature') {
                return;
            }
            
            const widgetKey = $input.data('widget');
            const enabled = $input.is(':checked');
            
            // Update enabled count in header badge (count only feature widgets)
            const enabledCount = $('.aisales-widget-card--feature .aisales-toggle-switch input:checked').length;
            $('#aisales-widgets-active-count').text(enabledCount);
            
            // Save to server
            this.saveWidgetState(widgetKey, enabled);
        },

        /**
         * Save widget enabled state
         */
        saveWidgetState: function(widgetKey, enabled) {
            $.ajax({
                url: aisalesWidgets.ajaxUrl,
                type: 'POST',
                data: {
                    action: 'aisales_toggle_widget',
                    nonce: aisalesWidgets.nonce,
                    widget: widgetKey,
                    enabled: enabled ? 1 : 0
                }
            });
        },

        /**
         * Open builder modal
         */
        openBuilder: function(e) {
            const widgetKey = $(e.currentTarget).data('widget');
            const widget = aisalesWidgets.widgets[widgetKey];
            
            if (!widget) return;
            
            // Set title
            $('#builder-modal-title').text(widget.name + ' Builder');
            
            // Build form
            this.buildForm(widgetKey, widget);
            
            // Update shortcode
            this.updateBuilderShortcode();
            
            // Show modal
            $('#builder-modal-overlay').show();
            $('body').addClass('aisales-modal-open');
        },

        /**
         * Build form for widget attributes
         */
        buildForm: function(widgetKey, widget) {
            const $form = $('#builder-form').empty();
            
            if (!widget.attributes) return;
            
            $.each(widget.attributes, function(attrKey, attr) {
                let $field = $('<div class="aisales-field"></div>');
                let $label = $('<label class="aisales-field__label">' + attrKey.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) + '</label>');
                let $input;
                
                if (attr.type === 'boolean') {
                    $input = $('<label class="aisales-toggle-switch"><input type="checkbox" name="' + attrKey + '" ' + (attr.default ? 'checked' : '') + '><span class="aisales-toggle-switch__slider"></span></label>');
                } else if (attr.type === 'select' && attr.options) {
                    $input = $('<select name="' + attrKey + '" class="aisales-select"></select>');
                    $.each(attr.options, function(i, opt) {
                        $input.append('<option value="' + opt + '" ' + (opt === attr.default ? 'selected' : '') + '>' + opt + '</option>');
                    });
                } else {
                    $input = $('<input type="' + (attr.type === 'number' ? 'number' : 'text') + '" name="' + attrKey + '" value="' + (attr.default || '') + '" class="aisales-input">');
                }
                
                if (attr.description) {
                    $field.append('<p class="aisales-field__help">' + attr.description + '</p>');
                }
                
                $field.append($label).append($input);
                $form.append($field);
            });
            
            // Store widget key for shortcode generation
            $form.data('widget-key', widgetKey);
            $form.data('shortcode', widget.shortcode);
        },

        /**
         * Update builder shortcode based on form values
         */
        updateBuilderShortcode: function() {
            const $form = $('#builder-form');
            const shortcodeBase = $form.data('shortcode');
            
            if (!shortcodeBase) return;
            
            let attrs = [];
            
            $form.find('input, select').each(function() {
                const $input = $(this);
                const name = $input.attr('name');
                let value;
                
                if ($input.attr('type') === 'checkbox') {
                    value = $input.is(':checked') ? '1' : '0';
                    if (value === '1') return; // Skip default true values
                } else {
                    value = $input.val();
                }
                
                if (value && value !== '') {
                    attrs.push(name + '="' + value + '"');
                }
            });
            
            const shortcode = '[' + shortcodeBase + (attrs.length ? ' ' + attrs.join(' ') : '') + ']';
            $('#builder-shortcode').text(shortcode);
        },

        /**
         * Close builder modal
         */
        closeBuilder: function() {
            $('#builder-modal-overlay').hide();
            $('body').removeClass('aisales-modal-open');
        },

        /**
         * Open docs modal
         */
        openDocs: function(e) {
            const widgetKey = $(e.currentTarget).data('widget');
            const widget = aisalesWidgets.widgets[widgetKey];
            
            if (!widget) return;
            
            $('#docs-modal-title').text(widget.name + ' Documentation');
            
            // Build documentation
            let html = '<div class="aisales-docs__section">';
            html += '<h3>Description</h3>';
            html += '<p>' + widget.description + '</p>';
            html += '</div>';
            
            html += '<div class="aisales-docs__section">';
            html += '<h3>Shortcode</h3>';
            html += '<code class="aisales-docs__code">[' + widget.shortcode + ']</code>';
            html += '</div>';
            
            if (widget.attributes) {
                html += '<div class="aisales-docs__section">';
                html += '<h3>Attributes</h3>';
                html += '<table class="aisales-docs__table"><thead><tr><th>Attribute</th><th>Type</th><th>Default</th><th>Description</th></tr></thead><tbody>';
                
                $.each(widget.attributes, function(key, attr) {
                    html += '<tr>';
                    html += '<td><code>' + key + '</code></td>';
                    html += '<td>' + attr.type + '</td>';
                    html += '<td>' + (attr.default !== undefined ? attr.default : '-') + '</td>';
                    html += '<td>' + (attr.description || '-') + '</td>';
                    html += '</tr>';
                });
                
                html += '</tbody></table>';
                html += '</div>';
            }
            
            $('#docs-content').html(html);
            $('#docs-modal-overlay').show();
            $('body').addClass('aisales-modal-open');
        },

        /**
         * Close docs modal
         */
        closeDocs: function() {
            $('#docs-modal-overlay').hide();
            $('body').removeClass('aisales-modal-open');
        },

        /**
         * Toggle color settings visibility
         */
        toggleColorSettings: function(e) {
            const mode = $(e.currentTarget).val();
            $('#custom-colors').toggle(mode === 'custom');
        },

        /**
         * Update duration display
         */
        updateDurationDisplay: function(e) {
            $('#popup-duration-value').text($(e.currentTarget).val());
        },

        /**
         * Save settings
         */
        saveSettings: function(e) {
            const $btn = $(e.currentTarget);
            const $icon = $btn.find('.dashicons');
            
            $btn.prop('disabled', true);
            $icon.attr('class', 'dashicons dashicons-update spin');
            
            // Collect settings
            const settings = {
                styling_mode: $('input[name="styling_mode"]:checked').val(),
                colors: {
                    primary: $('input[name="colors[primary]"]').val(),
                    success: $('input[name="colors[success]"]').val(),
                    urgency: $('input[name="colors[urgency]"]').val(),
                    text: $('input[name="colors[text]"]').val()
                },
                social_proof: {
                    privacy_level: $('select[name="social_proof[privacy_level]"]').val(),
                    popup_position: $('input[name="social_proof[popup_position]"]:checked').val(),
                    popup_duration: parseInt($('input[name="social_proof[popup_duration]"]').val())
                },
                conversion: {
                    shipping_threshold: parseFloat($('input[name="conversion[shipping_threshold]"]').val()) || 0,
                    stock_urgency_at: parseInt($('input[name="conversion[stock_urgency_at]"]').val()) || 10
                },
                cache_duration: parseInt($('select[name="cache_duration"]').val())
            };
            
            $.ajax({
                url: aisalesWidgets.ajaxUrl,
                type: 'POST',
                data: {
                    action: 'aisales_save_widget_settings',
                    nonce: aisalesWidgets.nonce,
                    settings: JSON.stringify(settings)
                },
                success: function(response) {
                    $icon.attr('class', 'dashicons dashicons-yes');
                    setTimeout(function() {
                        $icon.attr('class', 'dashicons dashicons-saved');
                        $btn.prop('disabled', false);
                    }, 1500);
                },
                error: function() {
                    $icon.attr('class', 'dashicons dashicons-no');
                    $btn.prop('disabled', false);
                }
            });
        },

        /**
         * Initialize tooltips
         */
        initTooltips: function() {
            // Simple tooltip implementation
        }
    };

    // Initialize on DOM ready
    $(document).ready(function() {
        WidgetsPage.init();
    });

})(jQuery);
