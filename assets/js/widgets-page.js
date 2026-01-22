/**
 * AI Sales Widgets Page JavaScript
 * 
 * Handles tab switching, copy functionality, modals, and settings.
 * @package AISales_Sales_Manager
 */

(function($) {
    'use strict';

    const WidgetsPage = {
        currentWidget: null,
        currentConfig: {},

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
            
            // Position dropdown change
            $(document).on('change', '.aisales-widget-card__position-select', this.handlePositionChange.bind(this));
            
            // Builder modal (legacy - keeping for shortcode builder)
            $(document).on('click', '.aisales-widget-card__builder-btn', this.openBuilder.bind(this));
            $(document).on('click', '#builder-modal-close, #builder-modal-overlay', this.closeBuilder.bind(this));
            $(document).on('click', '#builder-modal', function(e) { e.stopPropagation(); });
            
            // Settings modal (new per-widget settings)
            $(document).on('click', '.aisales-widget-card__settings-btn', this.openSettings.bind(this));
            $(document).on('click', '#settings-modal-close, #settings-modal-overlay', this.closeSettings.bind(this));
            $(document).on('click', '#settings-modal', function(e) { e.stopPropagation(); });
            $(document).on('click', '.aisales-settings-tab', this.handleSettingsTabClick.bind(this));
            $(document).on('click', '#settings-save', this.saveWidgetConfig.bind(this));
            $(document).on('click', '#settings-reset', this.resetWidgetConfig.bind(this));
            
            // Settings field change events
            $(document).on('input', '.aisales-settings-range__input', this.handleRangeInput.bind(this));
            $(document).on('input', '.aisales-settings-modal input[type="text"], .aisales-settings-modal textarea', this.handleConfigChange.bind(this));
            $(document).on('change', '.aisales-settings-modal input, .aisales-settings-modal select', this.handleConfigChange.bind(this));
            
            // Color picker sync
            $(document).on('input', '.aisales-settings-color__picker', this.handleColorPickerChange.bind(this));
            $(document).on('input', '.aisales-settings-color__hex', this.handleColorHexChange.bind(this));
            $(document).on('click', '.aisales-settings-color__clear', this.handleColorClear.bind(this));
            
            // Docs modal
            $(document).on('click', '.aisales-widget-card__docs-btn', this.openDocs.bind(this));
            $(document).on('click', '#docs-modal-close, #docs-modal-overlay', this.closeDocs.bind(this));
            $(document).on('click', '#docs-modal', function(e) { e.stopPropagation(); });
            
            // Global Settings (Settings tab)
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
                    this.closeSettings();
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
         * Handle widget toggle (only for feature/injectable-type widgets)
         */
        handleToggle: function(e) {
            const $input = $(e.currentTarget);
            const $card = $input.closest('.aisales-widget-card');
            
            // Only handle toggles for toggleable widgets (feature or injectable)
            if (!$card.hasClass('aisales-widget-card--toggleable')) {
                return;
            }
            
            const widgetKey = $input.data('widget');
            const enabled = $input.is(':checked');
            
            // Get position if this is an injectable widget
            const $positionSelect = $card.find('.aisales-widget-card__position-select');
            const position = $positionSelect.length ? $positionSelect.val() : '';
            
            // Update position dropdown state
            const $positionWrapper = $card.find('.aisales-widget-card__position');
            if ($positionWrapper.length) {
                $positionWrapper.attr('data-visible', enabled ? 'true' : 'false');
                $positionSelect.prop('disabled', !enabled);
            }
            
            // Update enabled count in header badge (count only toggleable widgets)
            const enabledCount = $('.aisales-widget-card--toggleable .aisales-toggle-switch input:checked').length;
            $('#aisales-widgets-active-count').text(enabledCount);
            
            // Save to server
            this.saveWidgetState(widgetKey, enabled, position);
        },

        /**
         * Handle position dropdown change
         */
        handlePositionChange: function(e) {
            const $select = $(e.currentTarget);
            const $card = $select.closest('.aisales-widget-card');
            const widgetKey = $select.data('widget');
            const position = $select.val();
            const $toggle = $card.find('.aisales-toggle-switch input');
            const enabled = $toggle.is(':checked');
            
            // Save the new position
            this.saveWidgetState(widgetKey, enabled, position);
        },

        /**
         * Save widget enabled state and position
         */
        saveWidgetState: function(widgetKey, enabled, position) {
            const data = {
                action: 'aisales_toggle_widget',
                nonce: aisalesWidgets.nonce,
                widget: widgetKey,
                enabled: enabled ? 1 : 0
            };
            
            if (position) {
                data.position = position;
            }
            
            $.ajax({
                url: aisalesWidgets.ajaxUrl,
                type: 'POST',
                data: data
            });
        },

        /**
         * Open settings modal for a widget
         */
        openSettings: function(e) {
            const widgetKey = $(e.currentTarget).data('widget');
            const widget = aisalesWidgets.widgets[widgetKey];
            
            if (!widget) return;
            
            this.currentWidget = widgetKey;
            
            // Set title
            $('#settings-modal-title').text(widget.name + ' Settings');
            
            // Reset to first tab
            $('.aisales-settings-tab').removeClass('aisales-settings-tab--active');
            $('.aisales-settings-tab[data-panel="appearance"]').addClass('aisales-settings-tab--active');
            $('.aisales-settings-panel').removeClass('aisales-settings-panel--active');
            $('#settings-panel-appearance').addClass('aisales-settings-panel--active');
            
            // Show loading state
            $('.aisales-settings-panel').html('<div style="text-align: center; padding: 40px; color: #71767b;">Loading...</div>');
            
            // Fetch widget config from server
            $.ajax({
                url: aisalesWidgets.ajaxUrl,
                type: 'POST',
                data: {
                    action: 'aisales_get_widget_config',
                    nonce: aisalesWidgets.nonce,
                    widget: widgetKey
                },
                success: function(response) {
                    if (response.success) {
                        this.currentConfig = response.data.config;
                        this.buildSettingsPanels(widget, response.data.schema, response.data.config);
                    }
                }.bind(this)
            });
            
            // Show modal
            $('#settings-modal-overlay').addClass('aisales-modal-overlay--active');
            $('#settings-modal').addClass('aisales-modal--active');
            $('body').addClass('aisales-modal-open');
        },

        /**
         * Build settings panels from widget schema
         */
        buildSettingsPanels: function(widget, schema, config) {
            const panels = {
                appearance: { icon: 'dashicons-admin-appearance', title: 'Spacing & Style' },
                display: { icon: 'dashicons-visibility', title: 'Display Options' },
                behavior: { icon: 'dashicons-controls-play', title: 'Behavior' },
                advanced: { icon: 'dashicons-admin-tools', title: 'Advanced' }
            };
            
            $.each(panels, function(panelKey, panelInfo) {
                const $panel = $('#settings-panel-' + panelKey);
                const fields = schema[panelKey] || {};
                
                if ($.isEmptyObject(fields)) {
                    $panel.html('<div style="text-align: center; padding: 40px; color: #536471;">No settings in this category</div>');
                    return;
                }
                
                let html = '<div class="aisales-settings-section">';
                html += '<div class="aisales-settings-section__header">';
                html += '<div class="aisales-settings-section__icon"><span class="dashicons ' + panelInfo.icon + '"></span></div>';
                html += '<h3 class="aisales-settings-section__title">' + panelInfo.title + '</h3>';
                html += '</div>';
                
                $.each(fields, function(fieldKey, field) {
                    const value = config[fieldKey] !== undefined ? config[fieldKey] : field.default;
                    html += this.buildSettingsField(fieldKey, field, value);
                }.bind(this));
                
                html += '</div>';
                
                // Add live preview for appearance panel
                if (panelKey === 'appearance') {
                    html += this.buildLivePreview(widget);
                }
                
                $panel.html(html);
            }.bind(this));
        },

        /**
         * Build a settings field
         */
        buildSettingsField: function(key, field, value) {
            const isFullWidth = field.type === 'textarea' || (field.type === 'text' && field.placeholders);
            let html = '<div class="aisales-settings-row' + (isFullWidth ? ' aisales-settings-row--full' : '') + '">';
            html += '<div class="aisales-settings-row__info">';
            html += '<label class="aisales-settings-row__label">' + field.label + '</label>';
            if (field.help) {
                html += '<p class="aisales-settings-row__help">' + field.help + '</p>';
            }
            html += '</div>';
            html += '<div class="aisales-settings-row__control">';
            
            switch (field.type) {
                case 'toggle':
                    html += '<label class="aisales-settings-toggle">';
                    html += '<input type="checkbox" name="' + key + '" ' + (value ? 'checked' : '') + '>';
                    html += '<span class="aisales-settings-toggle__track"></span>';
                    html += '<span class="aisales-settings-toggle__thumb"></span>';
                    html += '</label>';
                    break;
                    
                case 'range':
                    html += '<div class="aisales-settings-range">';
                    html += '<input type="range" class="aisales-settings-range__input" name="' + key + '" ';
                    html += 'value="' + value + '" min="' + (field.min || 0) + '" max="' + (field.max || 100) + '">';
                    html += '<span class="aisales-settings-range__value">' + value + (field.unit || '') + '</span>';
                    html += '</div>';
                    break;
                    
                case 'number':
                    html += '<div class="aisales-settings-input-unit">';
                    html += '<input type="number" class="aisales-settings-input" name="' + key + '" ';
                    html += 'value="' + value + '" min="' + (field.min || 0) + '" max="' + (field.max || 9999) + '">';
                    if (field.unit) {
                        html += '<span class="aisales-settings-input-unit__suffix">' + field.unit + '</span>';
                    }
                    html += '</div>';
                    break;
                    
                case 'select':
                    html += '<select class="aisales-settings-select" name="' + key + '">';
                    $.each(field.options, function(optKey, optLabel) {
                        const selected = (optKey == value) ? ' selected' : '';
                        html += '<option value="' + optKey + '"' + selected + '>' + optLabel + '</option>';
                    });
                    html += '</select>';
                    break;
                    
                case 'icons':
                    html += '<div class="aisales-settings-icons">';
                    $.each(field.options, function(iconKey, iconClass) {
                        const checked = (iconKey === value) ? ' checked' : '';
                        html += '<label class="aisales-settings-icon-option">';
                        html += '<input type="radio" name="' + key + '" value="' + iconKey + '"' + checked + '>';
                        html += '<span class="aisales-settings-icon-option__box"><span class="dashicons ' + iconClass + '"></span></span>';
                        html += '</label>';
                    });
                    html += '</div>';
                    break;
                    
                case 'color':
                    const hasValue = value && value !== '';
                    const colorValue = hasValue ? value : '#000000';
                    html += '<div class="aisales-settings-color">';
                    html += '<div class="aisales-settings-color__preview" style="' + (hasValue ? '' : 'background:repeating-conic-gradient(#ccc 0% 25%, #fff 0% 50%) 50%/10px 10px;') + '">';
                    html += '<input type="color" class="aisales-settings-color__picker" value="' + colorValue + '" data-for="' + key + '">';
                    html += '</div>';
                    html += '<input type="text" class="aisales-settings-color__hex" name="' + key + '" value="' + value + '" placeholder="transparent">';
                    if (field.help) {
                        html += '<button type="button" class="aisales-settings-color__clear" data-for="' + key + '" title="Clear">&times;</button>';
                    }
                    html += '</div>';
                    break;
                    
                case 'textarea':
                    html += '<textarea class="aisales-settings-textarea" name="' + key + '" rows="3">' + value + '</textarea>';
                    if (field.placeholders) {
                        html += '<div class="aisales-settings-placeholder-hint">';
                        html += '<div class="aisales-settings-placeholder-hint__title">Available placeholders</div>';
                        $.each(field.placeholders, function(i, placeholder) {
                            html += '<code>' + placeholder + '</code>';
                        });
                        html += '</div>';
                    }
                    break;
                    
                case 'text':
                default:
                    html += '<input type="text" class="aisales-settings-input' + (field.placeholders ? ' aisales-settings-input--wide' : '') + '" name="' + key + '" value="' + value + '">';
                    if (field.placeholders) {
                        html += '<div class="aisales-settings-placeholder-hint">';
                        html += '<div class="aisales-settings-placeholder-hint__title">Placeholders</div>';
                        $.each(field.placeholders, function(i, placeholder) {
                            html += '<code>' + placeholder + '</code>';
                        });
                        html += '</div>';
                    }
                    break;
            }
            
            html += '</div></div>';
            return html;
        },

        /**
         * Build live preview component
         */
        buildLivePreview: function(widget) {
            let html = '<div class="aisales-settings-preview">';
            html += '<div class="aisales-settings-preview__label">';
            html += '<span class="dashicons dashicons-visibility"></span> Live Preview';
            html += '</div>';
            html += '<div class="aisales-settings-preview__content" id="settings-live-preview">';
            html += this.renderPreviewContent(widget);
            html += '</div>';
            html += '</div>';
            return html;
        },

        /**
         * Render preview content based on widget type
         */
        renderPreviewContent: function(widget) {
            if (!widget) return '<span style="color: #71767b;">No preview available</span>';
            
            const config = this.currentConfig || {};
            
            // Get values from config or defaults
            const format = config.format || widget.settings?.display?.format?.default || '{count} sold';
            const iconStyle = config.icon_style || 'cart';
            const showIcon = config.show_icon !== false;
            const textColor = config.text_color || '#1a1a1a';
            const bgColor = config.bg_color || '';
            const iconColor = config.icon_color || '#f59e0b';
            
            // Sample data for preview
            const sampleCount = '1,234';
            const displayText = format.replace('{count}', sampleCount);
            
            // Build inline styles
            let style = 'color:' + textColor + ';';
            if (bgColor) {
                style += 'background-color:' + bgColor + ';padding:8px 12px;border-radius:6px;';
            }
            
            let html = '<div class="aisales-preview-widget" style="' + style + '">';
            
            if (showIcon) {
                const icons = {
                    'cart': '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="16" height="16"><path d="M7 18c-1.1 0-1.99.9-1.99 2S5.9 22 7 22s2-.9 2-2-.9-2-2-2zM1 2v2h2l3.6 7.59-1.35 2.45c-.16.28-.25.61-.25.96 0 1.1.9 2 2 2h12v-2H7.42c-.14 0-.25-.11-.25-.25l.03-.12.9-1.63h7.45c.75 0 1.41-.41 1.75-1.03l3.58-6.49c.08-.14.12-.31.12-.48 0-.55-.45-1-1-1H5.21l-.94-2H1zm16 16c-1.1 0-1.99.9-1.99 2s.89 2 1.99 2 2-.9 2-2-.9-2-2-2z"/></svg>',
                    'bag': '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="16" height="16"><path d="M18 6h-2c0-2.21-1.79-4-4-4S8 3.79 8 6H6c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zm-6-2c1.1 0 2 .9 2 2h-4c0-1.1.9-2 2-2zm6 16H6V8h2v2c0 .55.45 1 1 1s1-.45 1-1V8h4v2c0 .55.45 1 1 1s1-.45 1-1V8h2v12z"/></svg>',
                    'chart': '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="16" height="16"><path d="M5 9.2h3V19H5V9.2zM10.6 5h2.8v14h-2.8V5zm5.6 8H19v6h-2.8v-6z"/></svg>',
                    'fire': '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="16" height="16"><path d="M13.5.67s.74 2.65.74 4.8c0 2.06-1.35 3.73-3.41 3.73-2.07 0-3.63-1.67-3.63-3.73l.03-.36C5.21 7.51 4 10.62 4 14c0 4.42 3.58 8 8 8s8-3.58 8-8C20 8.61 17.41 3.8 13.5.67zM11.71 19c-1.78 0-3.22-1.4-3.22-3.14 0-1.62 1.05-2.76 2.81-3.12 1.77-.36 3.6-1.21 4.62-2.58.39 1.29.59 2.65.59 4.04 0 2.65-2.15 4.8-4.8 4.8z"/></svg>'
                };
                const iconSvg = icons[iconStyle] || icons['cart'];
                html += '<span style="display:inline-flex;color:' + iconColor + ';margin-right:6px;">' + iconSvg + '</span>';
            }
            
            html += '<span>' + displayText + '</span>';
            html += '</div>';
            
            return html;
        },

        /**
         * Update live preview
         */
        updateLivePreview: function() {
            const widget = aisalesWidgets.widgets[this.currentWidget];
            if (!widget) return;
            
            // Gather current form values
            const $modal = $('#settings-modal');
            const format = $modal.find('[name="format"]').val() || '{count} sold';
            const iconStyle = $modal.find('[name="icon_style"]:checked').val() || 'cart';
            const showIcon = $modal.find('[name="show_icon"]').is(':checked');
            const textColor = $modal.find('[name="text_color"]').val() || '#1a1a1a';
            const bgColor = $modal.find('[name="bg_color"]').val() || '';
            const iconColor = $modal.find('[name="icon_color"]').val() || '#f59e0b';
            
            const sampleCount = '1,234';
            const displayText = format.replace('{count}', sampleCount);
            
            // Build inline styles
            let style = 'color:' + textColor + ';';
            if (bgColor) {
                style += 'background-color:' + bgColor + ';padding:8px 12px;border-radius:6px;';
            }
            
            let html = '<div class="aisales-preview-widget" style="' + style + '">';
            
            if (showIcon) {
                const icons = {
                    'cart': '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="16" height="16"><path d="M7 18c-1.1 0-1.99.9-1.99 2S5.9 22 7 22s2-.9 2-2-.9-2-2-2zM1 2v2h2l3.6 7.59-1.35 2.45c-.16.28-.25.61-.25.96 0 1.1.9 2 2 2h12v-2H7.42c-.14 0-.25-.11-.25-.25l.03-.12.9-1.63h7.45c.75 0 1.41-.41 1.75-1.03l3.58-6.49c.08-.14.12-.31.12-.48 0-.55-.45-1-1-1H5.21l-.94-2H1zm16 16c-1.1 0-1.99.9-1.99 2s.89 2 1.99 2 2-.9 2-2-.9-2-2-2z"/></svg>',
                    'bag': '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="16" height="16"><path d="M18 6h-2c0-2.21-1.79-4-4-4S8 3.79 8 6H6c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zm-6-2c1.1 0 2 .9 2 2h-4c0-1.1.9-2 2-2zm6 16H6V8h2v2c0 .55.45 1 1 1s1-.45 1-1V8h4v2c0 .55.45 1 1 1s1-.45 1-1V8h2v12z"/></svg>',
                    'chart': '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="16" height="16"><path d="M5 9.2h3V19H5V9.2zM10.6 5h2.8v14h-2.8V5zm5.6 8H19v6h-2.8v-6z"/></svg>',
                    'fire': '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="16" height="16"><path d="M13.5.67s.74 2.65.74 4.8c0 2.06-1.35 3.73-3.41 3.73-2.07 0-3.63-1.67-3.63-3.73l.03-.36C5.21 7.51 4 10.62 4 14c0 4.42 3.58 8 8 8s8-3.58 8-8C20 8.61 17.41 3.8 13.5.67zM11.71 19c-1.78 0-3.22-1.4-3.22-3.14 0-1.62 1.05-2.76 2.81-3.12 1.77-.36 3.6-1.21 4.62-2.58.39 1.29.59 2.65.59 4.04 0 2.65-2.15 4.8-4.8 4.8z"/></svg>'
                };
                const iconSvg = icons[iconStyle] || icons['cart'];
                html += '<span style="display:inline-flex;color:' + iconColor + ';margin-right:6px;">' + iconSvg + '</span>';
            }
            
            html += '<span>' + displayText + '</span>';
            html += '</div>';
            
            $('#settings-live-preview').html(html);
        },

        /**
         * Handle color picker change - sync to hex input
         */
        handleColorPickerChange: function(e) {
            const $picker = $(e.currentTarget);
            const fieldName = $picker.data('for');
            const $hex = $picker.closest('.aisales-settings-color').find('.aisales-settings-color__hex');
            const $preview = $picker.closest('.aisales-settings-color__preview');
            
            $hex.val($picker.val()).trigger('input');
            $preview.css('background', '');
        },

        /**
         * Handle color hex input change - sync to picker
         */
        handleColorHexChange: function(e) {
            const $hex = $(e.currentTarget);
            const $picker = $hex.siblings('.aisales-settings-color__preview').find('.aisales-settings-color__picker');
            const $preview = $hex.siblings('.aisales-settings-color__preview');
            const value = $hex.val();
            
            if (value && /^#[0-9A-Fa-f]{6}$/.test(value)) {
                $picker.val(value);
                $preview.css('background', '');
            } else if (!value) {
                $preview.css('background', 'repeating-conic-gradient(#ccc 0% 25%, #fff 0% 50%) 50%/10px 10px');
            }
        },

        /**
         * Handle color clear button
         */
        handleColorClear: function(e) {
            const $btn = $(e.currentTarget);
            const $container = $btn.closest('.aisales-settings-color');
            const $hex = $container.find('.aisales-settings-color__hex');
            const $preview = $container.find('.aisales-settings-color__preview');
            
            $hex.val('').trigger('input');
            $preview.css('background', 'repeating-conic-gradient(#ccc 0% 25%, #fff 0% 50%) 50%/10px 10px');
        },

        /**
         * Handle settings tab click
         */
        handleSettingsTabClick: function(e) {
            const $tab = $(e.currentTarget);
            const panel = $tab.data('panel');
            
            $('.aisales-settings-tab').removeClass('aisales-settings-tab--active');
            $tab.addClass('aisales-settings-tab--active');
            
            $('.aisales-settings-panel').removeClass('aisales-settings-panel--active');
            $('#settings-panel-' + panel).addClass('aisales-settings-panel--active');
        },

        /**
         * Handle range input
         */
        handleRangeInput: function(e) {
            const $input = $(e.currentTarget);
            const $value = $input.siblings('.aisales-settings-range__value');
            const name = $input.attr('name');
            const widget = aisalesWidgets.widgets[this.currentWidget];
            
            // Find the field to get the unit
            let unit = '';
            if (widget && widget.settings) {
                $.each(widget.settings, function(panel, fields) {
                    if (fields[name] && fields[name].unit) {
                        unit = fields[name].unit;
                    }
                });
            }
            
            $value.text($input.val() + unit);
        },

        /**
         * Handle config field change
         */
        handleConfigChange: function(e) {
            const $input = $(e.currentTarget);
            const name = $input.attr('name');
            let value;
            
            if ($input.attr('type') === 'checkbox') {
                value = $input.is(':checked');
            } else if ($input.attr('type') === 'radio') {
                value = $('input[name="' + name + '"]:checked').val();
            } else {
                value = $input.val();
            }
            
            this.currentConfig[name] = value;
            
            // Update live preview
            this.updateLivePreview();
        },

        /**
         * Save widget configuration
         */
        saveWidgetConfig: function(e) {
            const $btn = $(e.currentTarget);
            const $icon = $btn.find('.dashicons');
            
            $btn.prop('disabled', true);
            $icon.attr('class', 'dashicons dashicons-update spin');
            
            // Collect all settings from the modal
            const config = {};
            $('#settings-modal').find('input, select, textarea').each(function() {
                const $input = $(this);
                const name = $input.attr('name');
                if (!name) return;
                
                if ($input.attr('type') === 'checkbox') {
                    config[name] = $input.is(':checked');
                } else if ($input.attr('type') === 'radio') {
                    if ($input.is(':checked')) {
                        config[name] = $input.val();
                    }
                } else {
                    config[name] = $input.val();
                }
            });
            
            $.ajax({
                url: aisalesWidgets.ajaxUrl,
                type: 'POST',
                data: {
                    action: 'aisales_save_widget_config',
                    nonce: aisalesWidgets.nonce,
                    widget: this.currentWidget,
                    config: JSON.stringify(config)
                },
                success: function(response) {
                    if (response.success) {
                        $icon.attr('class', 'dashicons dashicons-yes');
                        setTimeout(function() {
                            $icon.attr('class', 'dashicons dashicons-saved');
                            $btn.prop('disabled', false);
                        }, 1500);
                    } else {
                        $icon.attr('class', 'dashicons dashicons-no');
                        $btn.prop('disabled', false);
                    }
                },
                error: function() {
                    $icon.attr('class', 'dashicons dashicons-no');
                    $btn.prop('disabled', false);
                }
            });
        },

        /**
         * Reset widget configuration to defaults
         */
        resetWidgetConfig: function() {
            if (!confirm('Reset all settings for this widget to defaults?')) {
                return;
            }
            
            const widget = aisalesWidgets.widgets[this.currentWidget];
            if (!widget || !widget.settings) return;
            
            // Build defaults
            const defaults = {};
            $.each(widget.settings, function(panel, fields) {
                $.each(fields, function(key, field) {
                    if (field.default !== undefined) {
                        defaults[key] = field.default;
                    }
                });
            });
            
            this.currentConfig = defaults;
            this.buildSettingsPanels(widget, widget.settings, defaults);
        },

        /**
         * Close settings modal
         */
        closeSettings: function() {
            $('#settings-modal-overlay').removeClass('aisales-modal-overlay--active');
            $('#settings-modal').removeClass('aisales-modal--active');
            $('body').removeClass('aisales-modal-open');
            this.currentWidget = null;
            this.currentConfig = {};
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
            $('#builder-modal-overlay').addClass('aisales-modal-overlay--active');
            $('#builder-modal').addClass('aisales-modal--active');
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
            $('#builder-modal-overlay').removeClass('aisales-modal-overlay--active');
            $('#builder-modal').removeClass('aisales-modal--active');
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
            $('#docs-modal-overlay').addClass('aisales-modal-overlay--active');
            $('#docs-modal').addClass('aisales-modal--active');
            $('body').addClass('aisales-modal-open');
        },

        /**
         * Close docs modal
         */
        closeDocs: function() {
            $('#docs-modal-overlay').removeClass('aisales-modal-overlay--active');
            $('#docs-modal').removeClass('aisales-modal--active');
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
