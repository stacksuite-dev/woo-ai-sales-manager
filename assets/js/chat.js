/**
 * AISales Chat Interface
 *
 * @package AISales_Sales_Manager
 */

(function($) {
	'use strict';

	// Expose app globally for modules
	const app = window.AISalesChat = window.AISalesChat || {};

	// Chat state
	const state = app.state = {
		sessionId: null,
		entityType: 'product', // 'product' | 'category' | 'agent'
		selectedProduct: null,
		selectedCategory: null,
		isAgentMode: false,
		products: [],
		categories: [],
		messages: [],
		pendingSuggestions: {},
		isLoading: false,
		balance: 0,
		storeContext: {},
		// Attachment state
		pendingAttachments: [],
		maxAttachments: 5,
		maxFileSize: 7 * 1024 * 1024, // 7MB
		maxImageSize: 1024 * 1024, // 1MB - resize images larger than this
		allowedMimeTypes: ['image/png', 'image/jpeg', 'image/webp', 'image/heic', 'image/heif', 'application/pdf'],
		// Wizard state
		wizardStep: 1,
		wizardTask: null, // 'product' | 'category' | 'agent'
		wizardComplete: false
	};

	// DOM Elements
	const elements = app.elements = {
		// Entity switcher
		entityTabs: null,
		entitySelect: null,
		
		// Chat elements
		messageInput: null,
		sendButton: null,
		messagesContainer: null,
		chatWelcome: null,
		
		// Quick actions
		quickActionsProduct: null,
		quickActionsCategory: null,
		quickActionsAgent: null,
		
		// Entity panels
		entityPanel: null,
		entityEmpty: null,
		productInfo: null,
		categoryInfo: null,
		agentInfo: null,
		
		// Pending changes
		pendingSummary: null,
		categoryPendingSummary: null,
		
		// Header elements
		balanceDisplay: null,
		newChatButton: null,
		tokensUsed: null,
		
		// Store context
		storeContextBtn: null,
		contextPanel: null,
		contextBackdrop: null,
		contextForm: null,
		
		// Onboarding
		onboardingOverlay: null,
		
		// Welcome cards
		welcomeCards: null,
		
		// Wizard elements
		wizard: null,
		wizardSteps: null,
		wizardPanels: null,
		wizardCards: null,
		wizardSearch: null,
		wizardItems: null,
		wizardTitle: null,
		wizardSubtitle: null,
		wizardBack: null,
		wizardSetupContext: null,
		breadcrumb: null,
		breadcrumbType: null,
		breadcrumbName: null,
		breadcrumbChange: null
	};

	// Templates - expose to app for module access
	const templates = app.templates = {};

	// Utility function wrappers - use module if loaded, otherwise fall back to local
	const escapeHtml = app.utils ? app.utils.escapeHtml : function(str) {
		if (!str) return '';
		return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
	};
	const truncate = app.utils ? app.utils.truncate : function(str, len) {
		if (!str) return '';
		return str.length > len ? str.substring(0, len) + '...' : str;
	};
	const formatPrice = app.utils ? app.utils.formatPrice : null;
	const formatStock = app.utils ? app.utils.formatStock : null;
	const formatStatus = app.utils ? app.utils.formatStatus : null;
	const formatCurrency = app.utils ? app.utils.formatCurrency : null;
	const numberFormat = app.utils ? app.utils.numberFormat : function(num) {
		return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
	};
	const debounce = app.utils ? app.utils.debounce : function(func, wait) {
		var timeout;
		return function() {
			var context = this, args = arguments;
			clearTimeout(timeout);
			timeout = setTimeout(function() { func.apply(context, args); }, wait);
		};
	};
	const animateBalance = app.utils ? app.utils.animateBalance : null;
	const syncBalanceToWordPress = app.utils ? app.utils.syncBalanceToWordPress : null;
	const highlightSearchMatch = app.utils ? app.utils.highlightSearchMatch : null;

	// Attachment function wrappers - use module if loaded
	const clearAttachments = app.attachments ? app.attachments.clear : null;
	const updateAttachmentPreviews = app.attachments ? app.attachments.updatePreviews : null;

	/**
	 * Initialize the chat interface
	 */
	function init() {
		// Cache DOM elements
		cacheElements();

		// Load templates
		loadTemplates();

		// Initialize state from localized data
		if (typeof aisalesChat !== 'undefined') {
			state.products = aisalesChat.products || [];
			state.categories = aisalesChat.categories || [];
			state.balance = parseInt(aisalesChat.balance, 10) || 0;
			state.storeContext = aisalesChat.storeContext || {};
		}

		// Check for preselected entity type
		if (typeof window.aisalesPreselectedEntityType !== 'undefined') {
			state.entityType = window.aisalesPreselectedEntityType;
		}

		// Populate entity selector based on type
		if (app.entities && typeof app.entities.populateSelector === 'function') {
			app.entities.populateSelector();
		} else {
			populateEntitySelector();
		}

		// Bind events
		bindEvents();

		// Initialize attachments module (if loaded)
		if (app.attachments && typeof app.attachments.init === 'function') {
			app.attachments.init();
		}

		// Initialize context panel module (if loaded)
		if (app.context && typeof app.context.init === 'function') {
			app.context.init();
		}

		// Initialize entities module (if loaded)
		if (app.entities && typeof app.entities.init === 'function') {
			app.entities.init();
		}

		// Initialize messaging module (if loaded)
		if (app.messaging && typeof app.messaging.init === 'function') {
			app.messaging.init();
		}

		// Initialize suggestions module (if loaded)
		if (app.suggestions && typeof app.suggestions.init === 'function') {
			app.suggestions.init();
		}

		// Initialize images module (if loaded)
		if (app.images && typeof app.images.init === 'function') {
			app.images.init();
		}

		// Check for preselected product
		if (typeof window.aisalesPreselectedProduct !== 'undefined') {
			state.entityType = 'product';
			if (app.entities) {
				app.entities.updateTabs();
				app.entities.selectProduct(window.aisalesPreselectedProduct);
			} else {
				updateEntityTabs();
				selectProduct(window.aisalesPreselectedProduct);
			}
		}

		// Check for preselected category
		if (typeof window.aisalesPreselectedCategory !== 'undefined') {
			state.entityType = 'category';
			if (app.entities) {
				app.entities.updateTabs();
				app.entities.selectCategory(window.aisalesPreselectedCategory);
			} else {
				updateEntityTabs();
				selectCategory(window.aisalesPreselectedCategory);
			}
		}

		// Auto-resize textarea
		autoResizeTextarea();

		// Update UI based on initial entity type
		if (app.entities) {
			app.entities.updateTabs();
			app.entities.updateQuickActionsVisibility();
		} else {
			updateEntityTabs();
			updateQuickActionsVisibility();
		}
		
		// Initialize wizard module (if loaded)
		if (app.wizard && typeof app.wizard.init === 'function') {
			app.wizard.init();
		} else {
			// Fallback to local initWizard if module not loaded
			initWizard();
		}
	}

	/**
	 * Cache DOM elements
	 */
	function cacheElements() {
		// Entity switcher
		elements.entityTabs = $('.aisales-entity-tabs');
		elements.entitySelect = $('#aisales-entity-select');
		
		// Chat elements
		elements.messageInput = $('#aisales-message-input');
		elements.sendButton = $('#aisales-send-message');
		elements.messagesContainer = $('#aisales-chat-messages');
		elements.chatWelcome = $('#aisales-chat-welcome');
		
		// Quick actions
		elements.quickActionsProduct = $('#aisales-quick-actions-product');
		elements.quickActionsCategory = $('#aisales-quick-actions-category');
		elements.quickActionsAgent = $('#aisales-quick-actions-agent');
		
		// Entity panels
		elements.entityPanel = $('#aisales-entity-panel');
		elements.entityEmpty = $('#aisales-entity-empty');
		elements.productInfo = $('#aisales-product-info');
		elements.categoryInfo = $('#aisales-category-info');
		elements.agentInfo = $('#aisales-agent-info');
		
		// Pending changes
		elements.pendingSummary = $('#aisales-pending-summary');
		elements.categoryPendingSummary = $('#aisales-category-pending-summary');
		
		// Header elements
		elements.balanceDisplay = $('#aisales-balance-display');
		elements.newChatButton = $('#aisales-new-chat');
		elements.tokensUsed = $('#aisales-tokens-used');
		
		// Store context
		elements.storeContextBtn = $('#aisales-open-context');
		elements.contextPanel = $('#aisales-context-panel');
		elements.contextBackdrop = $('#aisales-context-backdrop');
		elements.contextForm = $('#aisales-context-form');
		
		// Onboarding
		elements.onboardingOverlay = $('#aisales-onboarding');
		
		// Welcome cards
		elements.welcomeCards = $('.aisales-welcome-cards');
		
		// Wizard elements
		elements.wizard = $('#aisales-wizard');
		elements.wizardSteps = $('.aisales-wizard__step');
		elements.wizardPanels = $('.aisales-wizard__panel');
		elements.wizardCards = $('.aisales-wizard__card');
		elements.wizardSearch = $('#aisales-wizard-search');
		elements.wizardItems = $('#aisales-wizard-items');
		elements.wizardTitle = $('#aisales-wizard-title');
		elements.wizardSubtitle = $('#aisales-wizard-subtitle');
		elements.wizardBack = $('.aisales-wizard__back');
		elements.wizardSetupContext = $('.aisales-wizard-setup-context');
		elements.breadcrumb = $('#aisales-chat-breadcrumb');
		elements.breadcrumbType = $('#aisales-breadcrumb-type');
		elements.breadcrumbName = $('#aisales-breadcrumb-name');
		elements.breadcrumbChange = $('#aisales-breadcrumb-change');
		
		// Attachment elements
		elements.attachButton = $('#aisales-attach-button');
		elements.fileInput = $('#aisales-file-input');
		elements.attachmentPreviews = $('#aisales-attachment-previews');
	}

	/**
	 * Load template strings
	 */
	function loadTemplates() {
		templates.message = $('#aisales-message-template').html() || '';
		templates.suggestion = $('#aisales-suggestion-template').html() || '';
		templates.thinking = $('#aisales-thinking-template').html() || '';
	}

	/**
	 * Populate product selector dropdown
	 */
	function populateProductSelector() {
		const $select = elements.entitySelect;
		$select.empty();
		$select.append($('<option>', {
			value: '',
			text: aisalesChat.i18n.selectProduct
		}));

		if (state.products.length === 0) {
			$select.append($('<option>', {
				value: '',
				text: aisalesChat.i18n.noProducts,
				disabled: true
			}));
			return;
		}

		state.products.forEach(function(product) {
			$select.append($('<option>', {
				value: product.id,
				text: product.title,
				'data-product': JSON.stringify(product)
			}));
		});
	}

	/**
	 * Populate category selector dropdown
	 */
	function populateCategorySelector() {
		const $select = elements.entitySelect;
		$select.empty();
		$select.append($('<option>', {
			value: '',
			text: aisalesChat.i18n.selectCategory || 'Select a category...'
		}));

		if (state.categories.length === 0) {
			$select.append($('<option>', {
				value: '',
				text: aisalesChat.i18n.noCategories || 'No categories found',
				disabled: true
			}));
			return;
		}

		state.categories.forEach(function(category) {
			const indent = '— '.repeat(category.depth || 0);
			$select.append($('<option>', {
				value: category.id,
				text: indent + category.name,
				'data-category': JSON.stringify(category)
			}));
		});
	}

	/**
	 * Populate entity selector based on current entity type
	 */
	function populateEntitySelector() {
		if (state.entityType === 'agent') {
			// Agent mode doesn't need entity selector
			elements.entitySelect.empty().hide();
			return;
		}
		
		elements.entitySelect.show();
		
		if (state.entityType === 'category') {
			populateCategorySelector();
		} else {
			populateProductSelector();
		}
	}

	/**
	 * Bind event handlers
	 */
	function bindEvents() {
		// Entity type tabs and selection - only bind if entities module not loaded
		if (!app.entities) {
			elements.entityTabs.on('click', '.aisales-entity-tab', handleEntityTabClick);
			elements.entitySelect.on('change', handleEntityChange);
			elements.entityPanel.on('click', '.aisales-expand-toggle', handleExpandToggle);
		}

		// Send message
		elements.sendButton.on('click', handleSendMessage);
		elements.messageInput.on('keydown', function(e) {
			if (e.key === 'Enter' && !e.shiftKey) {
				e.preventDefault();
				handleSendMessage();
			}
		});

		// Quick actions - Product
		elements.quickActionsProduct.on('click', '[data-action]', handleProductQuickAction);
		
		// Quick actions - Category
		elements.quickActionsCategory.on('click', '[data-action]', handleCategoryQuickAction);
		
		// Quick actions - Agent
		elements.quickActionsAgent.on('click', '[data-action]', handleAgentQuickAction);
		
		// Agent capabilities (right panel)
		elements.agentInfo.on('click', '.aisales-capability-btn', handleAgentQuickAction);

		// New chat
		elements.newChatButton.on('click', handleNewChat);

		// Suggestion-related events - only bind if suggestions module not loaded
		if (!app.suggestions) {
			// Accept/Discard all - Products
			$('#aisales-accept-all').on('click', handleAcceptAll);
			$('#aisales-discard-all').on('click', handleDiscardAll);
			
			// Accept/Discard all - Categories
			$('#aisales-category-accept-all').on('click', handleAcceptAll);
			$('#aisales-category-discard-all').on('click', handleDiscardAll);

			// Suggestion actions (delegated)
			elements.messagesContainer.on('click', '.aisales-suggestion [data-action]', handleSuggestionAction);

			// Catalog suggestion actions
			elements.messagesContainer.on('click', '.aisales-catalog-suggestion [data-action]', handleCatalogSuggestionAction);

			// Product panel suggestion actions
			elements.productInfo.on('click', '.aisales-pending-change__actions [data-action]', handlePendingChangeAction);
			
			// Category panel suggestion actions
			elements.categoryInfo.on('click', '.aisales-pending-change__actions [data-action]', handlePendingChangeAction);
		}

		// Inline options (conversational quick actions in AI messages)
		elements.messagesContainer.on('click', '.aisales-inline-option', handleInlineOptionClick);

		// Generated image actions - only bind if images module not loaded
		if (!app.images) {
			elements.messagesContainer.on('click', '.aisales-generated-image [data-action]', handleGeneratedImageAction);
			elements.messagesContainer.on('click', '.aisales-generated-image__expand', handleImageExpand);
			elements.messagesContainer.on('click', '.aisales-generated-image__img', handleImageExpand);
		}

		// Store context panel - only bind if context module not loaded
		if (!app.context) {
			elements.storeContextBtn.on('click', openContextPanel);
			$('#aisales-close-context, #aisales-cancel-context').on('click', closeContextPanel);
			elements.contextBackdrop.on('click', closeContextPanel);
			$('#aisales-save-context').on('click', saveStoreContext);
			$('#aisales-sync-context').on('click', syncStoreContext);

			// Onboarding
			$('#aisales-onboarding-setup').on('click', function() {
				closeOnboarding();
				openContextPanel();
			});
			$('#aisales-onboarding-skip').on('click', closeOnboarding);
			
			// Welcome context hint
			$('#aisales-welcome-setup-context').on('click', openContextPanel);
		}

		// Welcome cards
		elements.welcomeCards.on('click', '.aisales-welcome-card', handleWelcomeCardClick);
		
		// Attachment handling - only bind if module not loaded
		if (!app.attachments) {
			elements.attachButton.on('click', function() {
				elements.fileInput.click();
			});
			elements.fileInput.on('change', handleFileSelect);
			elements.attachmentPreviews.on('click', '.aisales-attachment-remove', handleRemoveAttachment);
			
			// Drag and drop
			setupDragAndDrop();
			
			// Paste handling for images
			elements.messageInput.on('paste', handlePaste);
		}
	}

	/**
	 * Handle file selection from input
	 */
	function handleFileSelect(e) {
		const files = Array.from(e.target.files || []);
		processFiles(files);
		// Reset input so same file can be selected again
		e.target.value = '';
	}

	/**
	 * Handle removing an attachment
	 */
	function handleRemoveAttachment(e) {
		const index = $(e.currentTarget).closest('.aisales-attachment-preview').data('index');
		state.pendingAttachments.splice(index, 1);
		if (app.attachments) {
			app.attachments.updatePreviews();
		}
	}

	/**
	 * Handle paste event for images
	 */
	function handlePaste(e) {
		const clipboardData = e.originalEvent.clipboardData;
		if (!clipboardData || !clipboardData.items) return;

		const items = Array.from(clipboardData.items);
		const imageItems = items.filter(item => item.type.startsWith('image/'));
		
		if (imageItems.length > 0) {
			e.preventDefault();
			const files = imageItems.map(item => item.getAsFile()).filter(Boolean);
			processFiles(files);
		}
	}

	/**
	 * Setup drag and drop for attachments
	 */
	function setupDragAndDrop() {
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
			processFiles(files);
		});
	}

	/**
	 * Process selected/dropped/pasted files
	 */
	function processFiles(files) {
		if (!files || files.length === 0) return;

		// Check max attachments
		const remainingSlots = state.maxAttachments - state.pendingAttachments.length;
		if (remainingSlots <= 0) {
			app.ui.showNotice('Maximum ' + state.maxAttachments + ' files allowed per message', 'error');
			return;
		}

		const filesToProcess = files.slice(0, remainingSlots);

		filesToProcess.forEach(function(file) {
			// Validate file type
			if (!state.allowedMimeTypes.includes(file.type)) {
				app.ui.showNotice('File type not supported: ' + file.name, 'error');
				return;
			}

			// Validate file size
			if (file.size > state.maxFileSize) {
				app.ui.showNotice('File too large: ' + file.name + ' (max ' + Math.round(state.maxFileSize / 1024 / 1024) + 'MB)', 'error');
				return;
			}

			// Process the file
			if (file.type.startsWith('image/') && file.size > state.maxImageSize) {
				// Resize large images
				resizeImage(file).then(function(resizedFile) {
					addAttachment(resizedFile);
				}).catch(function(err) {
					console.error('Image resize failed:', err);
					// Fall back to original
					addAttachment(file);
				});
			} else {
				addAttachment(file);
			}
		});
	}

	/**
	 * Add an attachment to pending list
	 */
	function addAttachment(file) {
		fileToBase64(file).then(function(base64Data) {
			state.pendingAttachments.push({
				file: file,
				filename: file.name,
				mime_type: file.type,
				data: base64Data,
				preview: file.type.startsWith('image/') ? URL.createObjectURL(file) : null
			});
			if (app.attachments) {
				app.attachments.updatePreviews();
			}
		}).catch(function(err) {
			console.error('Failed to read file:', err);
			app.ui.showNotice('Failed to read file: ' + file.name, 'error');
		});
	}

	/**
	 * Convert file to base64
	 */
	function fileToBase64(file) {
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
	}

	/**
	 * Resize image if too large (browser-side)
	 */
	function resizeImage(file) {
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
	}

	// updateAttachmentPreviews and clearAttachments moved to attachments.js module

	/**
	 * Handle entity tab click (switch between Products/Categories/Agent)
	 */
	function handleEntityTabClick(e) {
		const $tab = $(e.currentTarget);
		const newType = $tab.data('type');
		
		if (newType === state.entityType) return;
		
		// Switch entity type
		state.entityType = newType;
		state.isAgentMode = (newType === 'agent');
		
		// Update tabs UI
		updateEntityTabs();
		
		// Clear current selection (skip for agent - selectAgent handles cleanup)
		if (newType !== 'agent') {
			clearEntity();
		}
		
		// Populate selector with new entity type (or hide for agent)
		populateEntitySelector();
		
		// Update quick actions visibility
		updateQuickActionsVisibility();
		
		// Update empty state text and icon
		updateEmptyState();
		
		// If agent mode, activate immediately
		if (state.entityType === 'agent') {
			selectAgent();
		}
	}

	/**
	 * Update entity tabs UI
	 */
	function updateEntityTabs() {
		elements.entityTabs.find('.aisales-entity-tab').removeClass('aisales-entity-tab--active');
		elements.entityTabs.find('[data-type="' + state.entityType + '"]').addClass('aisales-entity-tab--active');
	}

	/**
	 * Update quick actions visibility based on entity type
	 */
	function updateQuickActionsVisibility() {
		elements.quickActionsProduct.hide();
		elements.quickActionsCategory.hide();
		elements.quickActionsAgent.hide();
		
		if (state.entityType === 'agent') {
			elements.quickActionsAgent.show();
		} else if (state.entityType === 'category') {
			elements.quickActionsCategory.show();
		} else {
			elements.quickActionsProduct.show();
		}
	}

	/**
	 * Update empty state text and icon
	 */
	function updateEmptyState() {
		const $icon = $('#aisales-empty-icon');
		const $text = $('#aisales-empty-text');
		
		if (state.entityType === 'agent') {
			$icon.attr('class', 'dashicons dashicons-superhero-alt');
			$text.text(aisalesChat.i18n.agentReady || 'AI Agent ready to help with marketing');
		} else if (state.entityType === 'category') {
			$icon.attr('class', 'dashicons dashicons-category');
			$text.text(aisalesChat.i18n.selectCategory || 'Select a category to view details');
		} else {
			$icon.attr('class', 'dashicons dashicons-products');
			$text.text(aisalesChat.i18n.selectProduct || 'Select a product to view details');
		}
	}

	/**
	 * Handle entity selection change
	 */
	function handleEntityChange() {
		const entityId = elements.entitySelect.val();
		if (!entityId) {
			clearEntity();
			return;
		}

		const $selected = elements.entitySelect.find(':selected');
		
		if (state.entityType === 'category') {
			const categoryData = $selected.data('category');
			if (categoryData) {
				selectCategory(categoryData);
			}
		} else {
			const productData = $selected.data('product');
			if (productData) {
				selectProduct(productData);
			}
		}
	}

	/**
	 * Handle product selection change (legacy support)
	 */
	function handleProductChange() {
		handleEntityChange();
	}

	/**
	 * Select a product and create/load session
	 */
	function selectProduct(product) {
		state.selectedProduct = product;
		state.selectedCategory = null;
		state.isAgentMode = false;
		app.panels.updateProductPanel(product);
		enableInputs();

		// Hide welcome, show product info
		elements.chatWelcome.hide();
		elements.entityEmpty.hide();
		elements.productInfo.show();
		elements.categoryInfo.hide();
		elements.agentInfo.hide();

		// Create new session for this product
		createSession(product, 'product');
	}

	/**
	 * Select a category and create/load session
	 */
	function selectCategory(category) {
		state.selectedCategory = category;
		state.selectedProduct = null;
		state.isAgentMode = false;
		app.panels.updateCategoryPanel(category);
		enableInputs();

		// Hide welcome, show category info
		elements.chatWelcome.hide();
		elements.entityEmpty.hide();
		elements.productInfo.hide();
		elements.categoryInfo.show();
		elements.agentInfo.hide();

		// Create new session for this category
		createSession(category, 'category');
	}

	/**
	 * Select agent mode (store-wide marketing operations)
	 */
	function selectAgent() {
		// Clear previous state
		state.selectedProduct = null;
		state.selectedCategory = null;
		state.sessionId = null;
		state.messages = [];
		state.pendingSuggestions = {};
		state.isAgentMode = true;
		
		// Clear messages display
		app.ui.clearMessages();
		
		// Enable inputs for agent mode
		enableInputs();

		// Hide welcome and other panels, show agent info
		elements.chatWelcome.hide();
		elements.entityEmpty.hide();
		elements.productInfo.hide();
		elements.categoryInfo.hide();
		elements.agentInfo.show();
		elements.pendingSummary.hide();

		// Create new session for agent mode
		createSession(null, 'agent');
	}

	/**
	 * Load and select a category by ID
	 */
	function loadAndSelectCategory(categoryId) {
		// Find category in state
		const category = state.categories.find(c => c.id == categoryId);
		if (category) {
			elements.entitySelect.val(categoryId);
			selectCategory(category);
		} else {
			// Fetch category data via AJAX
			$.ajax({
				url: aisalesChat.ajaxUrl,
				method: 'POST',
				data: {
					action: 'aisales_get_category',
					nonce: aisalesChat.nonce,
					category_id: categoryId
				},
				success: function(response) {
					if (response.success && response.data) {
						selectCategory(response.data);
					}
				}
			});
		}
	}

	/**
	 * Clear entity selection
	 */
	function clearEntity() {
		if (state.entityType === 'agent') {
			clearAgent();
		} else if (state.entityType === 'category') {
			clearCategory();
		} else {
			clearProduct();
		}
	}

	/**
	 * Clear product selection
	 */
	function clearProduct() {
		state.selectedProduct = null;
		state.sessionId = null;
		state.messages = [];
		state.pendingSuggestions = {};

		elements.productInfo.hide();
		elements.entityEmpty.show();
		elements.pendingSummary.hide();

		disableInputs();
		app.ui.showWelcomeMessage();
	}

	/**
	 * Clear category selection
	 */
	function clearCategory() {
		state.selectedCategory = null;
		state.sessionId = null;
		state.messages = [];
		state.pendingSuggestions = {};

		elements.categoryInfo.hide();
		elements.entityEmpty.show();
		elements.categoryPendingSummary.hide();

		disableInputs();
		app.ui.showWelcomeMessage();
	}

	/**
	 * Clear agent mode
	 */
	function clearAgent() {
		state.isAgentMode = false;
		state.sessionId = null;
		state.messages = [];
		state.pendingSuggestions = {};

		elements.agentInfo.hide();
		elements.entityEmpty.show();

		disableInputs();
		app.ui.showWelcomeMessage();
	}

	// updateProductPanel and updateCategoryPanel moved to panels.js module

	/**
	 * Create a new chat session
	 */
	function createSession(entity, entityType) {
		if (state.isLoading) return;

		setLoading(true);
		app.ui.clearMessages();

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
					loadSessionMessages(state.sessionId);
				} else {
					setLoading(false);
				}
			},
			error: function(xhr) {
				app.ui.handleError(xhr);
				setLoading(false);
			}
		});
	}

	/**
	 * Load messages for a session
	 */
	function loadSessionMessages(sessionId) {
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

				app.ui.renderMessages();
				app.updatePendingSummary();
				setLoading(false);
			},
			error: function(xhr) {
				app.ui.handleError(xhr);
				setLoading(false);
			}
		});
	}

	/**
	 * Handle send message
	 */
	function handleSendMessage() {
		const content = elements.messageInput.val().trim();
		if (!content || !state.sessionId || state.isLoading) return;

		sendMessage(content);
	}

	/**
	 * Send a message to the chat
	 */
	function sendMessage(content, quickAction) {
		if (state.isLoading) return;

		setLoading(true);
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
		app.ui.addMessage(messageData);

		// Clear attachments after capturing - use module if available
		if (app.attachments && typeof app.attachments.clear === 'function') {
			app.attachments.clear();
		} else if (typeof clearAttachments === 'function') {
			clearAttachments();
		}

		// Show thinking indicator
		app.ui.showThinking();

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
		sendMessageSSE(requestData);
	}

	/**
	 * Send message with SSE streaming
	 */
	function sendMessageSSE(requestData) {
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
				return handleSSEResponse(response);
			} else {
				// Regular JSON response
				return response.json().then(function(data) {
					app.ui.hideThinking();
					// Handle both wrapped {success, data} and direct response formats
					const responseData = data.data || data;
					if (responseData.assistant_message || responseData.suggestions) {
						handleMessageResponse(responseData);
					}
					setLoading(false);
				});
			}
		})
		.catch(function(error) {
			console.error('Chat error:', error);
			app.ui.hideThinking();
			
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
			
			app.ui.addErrorMessage(errorMessage);
			setLoading(false);
		});
	}

	/**
	 * Handle SSE streaming response
	 */
	function handleSSEResponse(response) {
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
						app.ui.hideThinking();
						hideToolProcessingMessage();
						// Create assistant message if not already created by message_start
						if (!assistantMessage) {
							assistantMessage = {
								id: 'msg-' + Date.now(),
								role: 'assistant',
								content: '',
								created_at: new Date().toISOString()
							};
						}
						app.ui.addMessage(assistantMessage, true);
					}
					messageContent += data.delta;
					app.ui.updateStreamingMessage(messageContent);
				}
				break;

				case 'suggestion':
					if (data.suggestion) {
						app.handleSuggestionReceived(data.suggestion);
					}
					break;

				case 'usage':
					if (data.tokens) {
						app.ui.updateTokensUsed(data.tokens);
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
							showToolProcessingMessage(data.interim_message);
						}
						// Fetch tool data and continue conversation
						handleToolDataRequests(data.requests);
					}
					break;

				case 'tool_processing':
					// Status update about tool processing
					if (data.message) {
						showToolProcessingMessage(data.message);
					}
					break;

				case 'image_generating':
					// AI is generating an image
					app.showImageGeneratingIndicator(data.prompt || 'Creating your image...');
					break;

			case 'image_generated':
				// Image generation complete
				app.hideImageGeneratingIndicator();
				if (data.url) {
					app.appendGeneratedImage(data);
				}
				break;

			case 'catalog_suggestion':
				// Catalog reorganization suggestion from AI
				if (data.suggestion) {
					app.renderCatalogSuggestion(data.suggestion);
				}
				break;

			case 'research_confirmation':
				// Market research requires user confirmation
				if (data) {
					app.showResearchConfirmation(data);
				}
				break;

			case 'done':
					setLoading(false);
					break;

				case 'error':
					app.ui.hideThinking();
					app.ui.addErrorMessage(data.message || aisalesChat.i18n.errorOccurred);
					setLoading(false);
					break;
			}
		}

		function read() {
			return reader.read().then(function(result) {
				if (result.done) {
					setLoading(false);
					return;
				}
				processChunk(result.value);
				return read();
			});
		}

		return read();
	}

	/**
	 * Show tool processing status message
	 * Displays a temporary status indicator while AI tools fetch data
	 */
	function showToolProcessingMessage(message) {
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
		app.ui.scrollToBottom();
	}

	/**
	 * Hide tool processing message
	 */
	function hideToolProcessingMessage() {
		elements.messagesContainer.find('.aisales-message--tool-processing').remove();
	}

	// Image & catalog suggestion functions moved to images.js and suggestions.js modules

	/**
	 * Handle inline option click (conversational quick actions)
	 */
	function handleInlineOptionClick(e) {
		var $btn = $(e.currentTarget);
		var value = $btn.data('option-value');

		if (!value) return;

		// Disable all options in this group and mark selected
		$btn.closest('.aisales-inline-options').find('.aisales-inline-option').prop('disabled', true);
		$btn.addClass('aisales-inline-option--selected');

		// Send as user message
		sendMessage(value);
	}

	// Image action functions moved to images.js module

	/**
	 * Create error results for failed tool requests
	 */
	function createToolErrorResults(requests, errorMessage) {
		return requests.map(function(req) {
			return {
				request_id: req.request_id,
				tool: req.tool,
				success: false,
				error: errorMessage
			};
		});
	}

	/**
	 * Handle tool data requests from AI
	 * Fetches data via WordPress AJAX and sends results back to API
	 */
	function handleToolDataRequests(requests) {
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
				hideToolProcessingMessage();
				if (response.success && response.data && response.data.tool_results) {
					sendToolResults(response.data.tool_results);
				} else {
					sendToolResults(createToolErrorResults(requests, response.data || 'Failed to fetch tool data'));
				}
			},
			error: function(xhr) {
				hideToolProcessingMessage();
				console.error('Tool data fetch error:', xhr);
				sendToolResults(createToolErrorResults(requests, 'Network error fetching tool data'));
			}
		});
	}

	/**
	 * Send tool results back to API to continue the conversation
	 */
	function sendToolResults(toolResults) {
		if (!state.sessionId || !toolResults || toolResults.length === 0) {
			return;
		}

		// Show thinking indicator while AI processes the results
		app.ui.showThinking();

		const requestData = {
			role: 'tool',
			content: 'Tool execution results',
			tool_results: toolResults
		};

		// Send tool results using SSE for streaming response
		const url = aisalesChat.apiBaseUrl + '/ai/chat/sessions/' + state.sessionId + '/messages';
		console.log('[AISales Debug] Sending tool results to API');
		console.log('[AISales Debug] URL:', url);
		console.log('[AISales Debug] Request body:', JSON.stringify(requestData, null, 2));

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
				return handleSSEResponse(response);
			} else {
				return response.json().then(function(data) {
					app.ui.hideThinking();
					const responseData = data.data || data;
					if (responseData.assistant_message || responseData.suggestions) {
						handleMessageResponse(responseData);
					}
					setLoading(false);
				});
			}
		})
		.catch(function(error) {
			console.error('[AISales Debug] Tool results send error:', error);
			console.error('[AISales Debug] Error data:', JSON.stringify(error.data, null, 2));
			app.ui.hideThinking();

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
			
			app.ui.addErrorMessage(errorMessage);
			setLoading(false);
		});
	}

	/**
	 * Handle message response (non-SSE)
	 */
	function handleMessageResponse(data) {
		if (data.assistant_message) {
			app.ui.addMessage(data.assistant_message);
		}

		if (data.suggestions && data.suggestions.length > 0) {
			data.suggestions.forEach(function(suggestion) {
				app.handleSuggestionReceived(suggestion);
			});
		}

		if (data.tokens_used) {
			app.ui.updateTokensUsed(data.tokens_used);
			app.ui.updateBalance(-data.tokens_used.total);
		}
	}

	// handleSuggestionReceived moved to suggestions.js module

	/**
	 * Handle product quick action button click
	 */
	function handleProductQuickAction(e) {
		const action = $(e.currentTarget).data('action');
		if (!action || !state.selectedProduct) return;

		// Show modal for image generation actions
		if (action === 'generate_product_image' || action === 'enhance_product_image') {
			app.showImageGenerationModal('product');
			return;
		}

		const actionMessages = {
			'improve_title': 'Please improve the product title',
			'improve_description': 'Please improve the product description',
			'seo_optimize': 'Please optimize this product for SEO',
			'suggest_tags': 'Please suggest relevant tags for this product',
			'suggest_categories': 'Please suggest appropriate categories for this product',
			'generate_content': 'Please generate comprehensive content for this product'
		};

		const message = actionMessages[action] || 'Help with this product';
		sendMessage(message, action);
	}

	/**
	 * Handle category quick action button click
	 */
	function handleCategoryQuickAction(e) {
		const action = $(e.currentTarget).data('action');
		if (!action || !state.selectedCategory) return;

		// Show modal for image generation action
		if (action === 'generate_category_image') {
			app.showImageGenerationModal('category');
			return;
		}

		const actionMessages = {
			'improve_name': 'Please suggest a better name for this category',
			'improve_cat_description': 'Please generate a compelling description for this category',
			'cat_seo_optimize': 'Please optimize this category for SEO including title and meta description',
			'generate_cat_content': 'Please fully optimize this category - improve the name, generate a description, and add SEO content'
		};

		const message = actionMessages[action] || 'Help with this category';
		sendMessage(message, action);
	}

	/**
	 * Handle agent quick action button click
	 */
	function handleAgentQuickAction(e) {
		const action = $(e.currentTarget).data('action');
		if (!action || !state.isAgentMode) return;

		// Show modal for image generation action
		if (action === 'generate_image') {
			app.showImageGenerationModal('agent');
			return;
		}

		const actionMessages = {
			'create_campaign': 'Help me create a marketing campaign for my store',
			'social_content': 'Generate social media content for my store products',
			'email_campaign': 'Create an email marketing campaign',
			'store_analysis': 'Analyze my store and suggest improvements',
			'bulk_optimize': 'Suggest bulk optimization strategies for my products',
			'catalog_organize': 'Analyze my catalog structure and suggest improvements',
			'catalog_research': 'Help me with market research for my store'
		};

		const message = actionMessages[action] || 'Help with marketing';
		sendMessage(message, action);
	}

	/**
	 * Handle new chat button
	 */
	function handleNewChat() {
		// Clear pending state
		state.pendingSuggestions = {};
		app.updatePendingSummary();
		app.suggestions.clearPendingChanges();
		
		// Clear current session
		state.sessionId = null;
		state.messages = [];
		state.selectedProduct = null;
		state.selectedCategory = null;
		state.isAgentMode = false;
		
		// Clear chat messages UI
		elements.messagesContainer.find('.aisales-message').remove();
		elements.chatWelcome.show();
		
		// Hide entity panels
		elements.productInfo.hide();
		elements.categoryInfo.hide();
		elements.agentInfo.hide();
		elements.entityEmpty.show();
		
		// Disable quick actions
		$('.aisales-quick-actions button[data-action]').prop('disabled', true);
		
		// Reset and show wizard for new selection
		resetWizard();
		showWizard();
	}

	// Suggestion action functions moved to suggestions.js module:
	// handleSuggestionAction, handlePendingChangeAction, applySuggestion,
	// discardSuggestion, editSuggestion, handleAcceptAll, handleDiscardAll

	/**
	 * Handle expand toggle for description
	 */
	function handleExpandToggle(e) {
		const $field = $(e.currentTarget).closest('.aisales-product-info__field, .aisales-category-info__field');
		$field.toggleClass('aisales-product-info__field--expanded aisales-category-info__field--expanded');
		$field.find('.aisales-product-info__value, .aisales-category-info__value').toggleClass('aisales-product-info__value--truncated aisales-category-info__value--truncated');
	}

	/**
	 * Handle welcome card click
	 */
	function handleWelcomeCardClick(e) {
		const $card = $(e.currentTarget);
		const entityType = $card.data('entity');
		
		if (entityType && entityType !== state.entityType) {
			state.entityType = entityType;
			state.isAgentMode = (entityType === 'agent');
			updateEntityTabs();
			populateEntitySelector();
			updateQuickActionsVisibility();
			updateEmptyState();
			
			// If agent mode, activate immediately
			if (entityType === 'agent') {
				selectAgent();
				return;
			}
		}
		
		// Focus the selector (for product/category modes)
		elements.entitySelect.focus();
	}

	/**
	 * Open store context panel
	 */
	function openContextPanel() {
		elements.contextPanel.addClass('aisales-context-panel--open');
		$('body').addClass('aisales-context-panel-active');
	}

	/**
	 * Close store context panel
	 */
	function closeContextPanel() {
		elements.contextPanel.removeClass('aisales-context-panel--open');
		$('body').removeClass('aisales-context-panel-active');
	}

	/**
	 * Save store context
	 */
	function saveStoreContext() {
		const formData = {
			store_name: $('#aisales-store-name').val(),
			store_description: $('#aisales-store-description').val(),
			business_niche: $('#aisales-business-niche').val(),
			target_audience: $('#aisales-target-audience').val(),
			brand_tone: $('input[name="brand_tone"]:checked').val() || '',
			language: $('#aisales-language').val(),
			custom_instructions: $('#aisales-custom-instructions').val()
		};

		const $saveBtn = $('#aisales-save-context');
		$saveBtn.addClass('aisales-btn--loading').prop('disabled', true);

		$.ajax({
			url: aisalesChat.ajaxUrl,
			method: 'POST',
			data: {
				action: 'aisales_save_store_context',
				nonce: aisalesChat.nonce,
				context: formData
			},
			success: function(response) {
				if (response.success) {
					state.storeContext = formData;
					updateContextStatus(formData);
					closeContextPanel();
					
					// Show success notice
					app.ui.showNotice('Store context saved successfully', 'success');
				} else {
					app.ui.showNotice(response.data || 'Failed to save store context', 'error');
				}
			},
			error: function() {
				app.ui.showNotice('Failed to save store context', 'error');
			},
			complete: function() {
				$saveBtn.removeClass('aisales-btn--loading').prop('disabled', false);
			}
		});
	}

	/**
	 * Sync store context (re-fetch category/product counts)
	 */
	function syncStoreContext() {
		const $syncBtn = $('#aisales-sync-context');
		$syncBtn.addClass('aisales-btn--loading').prop('disabled', true);

		$.ajax({
			url: aisalesChat.ajaxUrl,
			method: 'POST',
			data: {
				action: 'aisales_sync_store_context',
				nonce: aisalesChat.nonce
			},
			success: function(response) {
				if (response.success) {
					$('#aisales-sync-status').text(response.data.message || 'Synced successfully');
				} else {
					app.ui.showNotice(response.data || 'Sync failed', 'error');
				}
			},
			error: function() {
				app.ui.showNotice('Sync failed', 'error');
			},
			complete: function() {
				$syncBtn.removeClass('aisales-btn--loading').prop('disabled', false);
			}
		});
	}

	/**
	 * Update context status indicator
	 */
	function updateContextStatus(context) {
		const hasRequired = context.store_name || context.business_niche;
		const hasOptional = context.target_audience || context.brand_tone;
		
		let status = 'missing';
		if (hasRequired) {
			status = hasOptional ? 'configured' : 'partial';
		}

		$('.aisales-context-status')
			.removeClass('aisales-context-status--configured aisales-context-status--partial aisales-context-status--missing')
			.addClass('aisales-context-status--' + status);

		// Update store name in button
		if (context.store_name) {
			$('.aisales-store-name').text(context.store_name);
		}
	}

	/**
	 * Close onboarding overlay
	 */
	function closeOnboarding() {
		elements.onboardingOverlay.fadeOut(300, function() {
			$(this).remove();
		});

		// Mark as visited
		$.ajax({
			url: aisalesChat.ajaxUrl,
			method: 'POST',
			data: {
				action: 'aisales_mark_chat_visited',
				nonce: aisalesChat.nonce
			}
		});
	}

	// UI functions moved to ui.js module:
	// showNotice, addMessage, renderMessage, updateStreamingMessage, renderMessages,
	// clearMessages, showWelcomeMessage, showThinking, hideThinking, addErrorMessage,
	// updateTokensUsed, updateBalance

	// renderSuggestionInMessage and renderSuggestionOption moved to suggestions.js module

	// Pending change and field update functions moved to suggestions.js module:
	// showPendingChange, hidePendingChange, clearPendingChanges, updatePendingSummary,
	// updateProductField, updateCategoryField, saveProductField, saveCategoryField

	// syncBalanceToWordPress moved to utils.js module

	/**
	 * Save AI-generated image to WordPress media library
	 * @param {string} imageData - Base64 encoded image data (with or without data URL prefix)
	 * @param {string} filename - Suggested filename for the image
	 * @param {string} title - Optional title for the media item
	 * @returns {Promise} - Resolves with attachment data or rejects with error
	 */
	function saveGeneratedImage(imageData, filename, title) {
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
						app.ui.showNotice(response.data.message || 'Image saved to media library', 'success');
						resolve(response.data);
					} else {
						app.ui.showNotice(response.data.message || 'Failed to save image', 'error');
						reject(new Error(response.data.message || 'Failed to save image'));
					}
				},
				error: function(xhr) {
					var message = 'Failed to save image';
					if (xhr.responseJSON && xhr.responseJSON.data && xhr.responseJSON.data.message) {
						message = xhr.responseJSON.data.message;
					}
					app.ui.showNotice(message, 'error');
					reject(new Error(message));
				}
			});
		});
	}

	/**
	 * Get store summary for agent context
	 * @returns {Promise} - Resolves with store summary data
	 */
	function getStoreSummary() {
		return new Promise(function(resolve, reject) {
			$.ajax({
				url: aisalesChat.ajaxUrl,
				type: 'POST',
				data: {
					action: 'aisales_get_store_summary',
					nonce: aisalesChat.nonce
				},
				success: function(response) {
					if (response.success) {
						resolve(response.data);
					} else {
						reject(new Error(response.data.message || 'Failed to get store summary'));
					}
				},
				error: function(xhr) {
					var message = 'Failed to get store summary';
					if (xhr.responseJSON && xhr.responseJSON.data && xhr.responseJSON.data.message) {
						message = xhr.responseJSON.data.message;
					}
					reject(new Error(message));
				}
			});
		});
	}

	/**
	 * Enable input elements
	 */
	function enableInputs() {
		elements.messageInput.prop('disabled', false);
		elements.sendButton.prop('disabled', false);
		
		if (state.entityType === 'agent') {
			elements.quickActionsAgent.find('button').prop('disabled', false);
		} else if (state.entityType === 'category') {
			elements.quickActionsCategory.find('button').prop('disabled', false);
		} else {
			elements.quickActionsProduct.find('button').prop('disabled', false);
		}
	}

	/**
	 * Disable input elements
	 */
	function disableInputs() {
		elements.messageInput.prop('disabled', true);
		elements.sendButton.prop('disabled', true);
		elements.quickActionsProduct.find('button').prop('disabled', true);
		elements.quickActionsCategory.find('button').prop('disabled', true);
		elements.quickActionsAgent.find('button').prop('disabled', true);
	}

	/**
	 * Set loading state
	 */
	function setLoading(loading) {
		state.isLoading = loading;
		const hasEntity = state.isAgentMode || (state.entityType === 'category' ? state.selectedCategory : state.selectedProduct);
		elements.sendButton.prop('disabled', loading || !hasEntity);
		elements.messageInput.prop('disabled', loading || !hasEntity);

		if (loading) {
			elements.sendButton.addClass('aisales-btn--loading');
		} else {
			elements.sendButton.removeClass('aisales-btn--loading');
		}
	}

	// scrollToBottom, autoResizeTextarea, and handleError moved to ui.js module

	// Formatting functions moved to formatting.js module:
	// formatMessageContent, renderInlineOptions, formatTime, formatPrice, formatCurrency,
	// formatStock, formatStatus, escapeHtml, truncate, numberFormat, animateBalance

	// showImageGenerationModal and closeImageGenerationModal moved to images.js module

	/* ==========================================================================
	   WIZARD FUNCTIONS
	   Step-by-step guided flow for task and entity selection
	   ========================================================================== */

	/**
	 * Initialize the wizard
	 * Checks for preselected entities and shows/hides wizard accordingly
	 */
	function initWizard() {
		// Check if there's a preselected product or category (skip wizard)
		if (typeof window.aisalesPreselectedProduct !== 'undefined' && window.aisalesPreselectedProduct) {
			state.wizardComplete = true;
			state.wizardTask = 'product';
			hideWizard();
			updateBreadcrumb('product', window.aisalesPreselectedProduct.title);
			return;
		}
		
		if (typeof window.aisalesPreselectedCategory !== 'undefined' && window.aisalesPreselectedCategory) {
			state.wizardComplete = true;
			state.wizardTask = 'category';
			hideWizard();
			updateBreadcrumb('category', window.aisalesPreselectedCategory.name);
			return;
		}
		
		// Check localStorage for last session (optional persistence)
		const lastSession = localStorage.getItem('aisales_wizard_session');
		if (lastSession) {
			try {
				const session = JSON.parse(lastSession);
				// Only restore if it was recent (within 30 minutes)
				if (session.timestamp && (Date.now() - session.timestamp) < 30 * 60 * 1000) {
					// Don't auto-restore, just let them pick fresh
				}
			} catch (e) {
				// Ignore parse errors
			}
		}
		
		// Show wizard if no preselection
		showWizard();
		bindWizardEvents();
	}

	/**
	 * Bind wizard event handlers
	 */
	function bindWizardEvents() {
		// Task card selection (Step 1)
		elements.wizardCards.on('click', function() {
			const task = $(this).data('task');
			selectWizardTask(task);
		});
		
		// Back button (Step 2)
		elements.wizardBack.on('click', function() {
			goToWizardStep(1);
		});
		
		// Search input
		elements.wizardSearch.on('input', debounce(filterWizardItems, 200));
		
		// Entity item selection (delegated)
		elements.wizardItems.on('click', '.aisales-wizard__item', function() {
			const $item = $(this);
			const entityId = $item.data('id');
			const entityData = $item.data('entity');
			selectWizardEntity(entityId, entityData);
		});
		
		// Breadcrumb change button
		elements.breadcrumbChange.on('click', function() {
			showWizard();
		});
		
		// Setup context link in wizard
		elements.wizardSetupContext.on('click', function() {
			openContextPanel();
		});
		
		// Escape key to close wizard (if allowed)
		$(document).on('keydown.wizard', function(e) {
			if (e.key === 'Escape' && state.wizardComplete) {
				hideWizard();
			}
		});
	}

	/**
	 * Select a task in the wizard (Step 1)
	 */
	function selectWizardTask(task) {
		state.wizardTask = task;
		state.entityType = task;
		
		// Update legacy entity tabs for compatibility
		updateEntityTabs();
		
		if (task === 'agent') {
			// Agent mode skips step 2 - go directly to chat
			completeWizard();
			selectAgent();
		} else {
			// Go to Step 2 for product/category selection
			goToWizardStep(2);
			populateWizardItems();
			
			// Update title and subtitle based on task
			if (task === 'product') {
				elements.wizardTitle.text(aisalesChat.i18n.selectProduct || 'Select a Product');
				elements.wizardSubtitle.text(aisalesChat.i18n.selectProductHint || 'Choose a product to optimize with AI');
			} else {
				elements.wizardTitle.text(aisalesChat.i18n.selectCategory || 'Select a Category');
				elements.wizardSubtitle.text(aisalesChat.i18n.selectCategoryHint || 'Choose a category to optimize with AI');
			}
		}
	}

	/**
	 * Navigate to a specific wizard step
	 */
	function goToWizardStep(step) {
		state.wizardStep = step;
		
		// Update step indicators
		elements.wizardSteps.each(function() {
			const $step = $(this);
			const stepNum = parseInt($step.data('step'), 10);
			
			$step.removeClass('aisales-wizard__step--active aisales-wizard__step--completed');
			
			if (stepNum < step) {
				$step.addClass('aisales-wizard__step--completed');
			} else if (stepNum === step) {
				$step.addClass('aisales-wizard__step--active');
			}
		});
		
		// Update panels
		elements.wizardPanels.removeClass('aisales-wizard__panel--active');
		$('.aisales-wizard__panel[data-panel="' + step + '"]').addClass('aisales-wizard__panel--active');
		
		// Clear search when going back
		if (step === 1) {
			elements.wizardSearch.val('');
			state.wizardTask = null;
		}
	}

	/**
	 * Populate wizard items list (Step 2)
	 */
	function populateWizardItems() {
		const $container = elements.wizardItems;
		const isProduct = state.wizardTask === 'product';
		const items = isProduct ? state.products : state.categories;
		
		// Show loading skeleton first
		showWizardLoadingSkeleton();
		
		// Simulate brief loading for smoother UX (items are already loaded, but skeleton looks better)
		setTimeout(function() {
			$container.empty();
			
			// Remove any existing results count
			$('.aisales-wizard__results-count').remove();
			
			if (!items || items.length === 0) {
				// Enhanced empty state
				const emptyIcon = isProduct ? 'dashicons-products' : 'dashicons-category';
				const emptyTitle = isProduct 
					? (aisalesChat.i18n.noProductsTitle || 'No products yet')
					: (aisalesChat.i18n.noCategoriesTitle || 'No categories yet');
				const emptyText = isProduct
					? (aisalesChat.i18n.noProductsText || 'Create your first product to start optimizing with AI.')
					: (aisalesChat.i18n.noCategoriesText || 'Create categories to organize your products.');
				const emptyAction = isProduct
					? (aisalesChat.i18n.createProduct || 'Create Product')
					: (aisalesChat.i18n.createCategory || 'Create Category');
				const emptyUrl = isProduct 
					? (aisalesChat.urls?.newProduct || 'post-new.php?post_type=product')
					: (aisalesChat.urls?.newCategory || 'edit-tags.php?taxonomy=product_cat&post_type=product');
				
				$container.html(
					'<div class="aisales-wizard__empty">' +
						'<div class="aisales-wizard__empty-icon">' +
							'<span class="dashicons ' + emptyIcon + '"></span>' +
						'</div>' +
						'<h4 class="aisales-wizard__empty-title">' + escapeHtml(emptyTitle) + '</h4>' +
						'<p class="aisales-wizard__empty-text">' + escapeHtml(emptyText) + '</p>' +
						'<a href="' + escapeHtml(emptyUrl) + '" class="aisales-wizard__empty-action">' +
							'<span class="dashicons dashicons-plus-alt2"></span>' +
							escapeHtml(emptyAction) +
						'</a>' +
					'</div>'
				);
				return;
			}
			
			// Populate items
			items.forEach(function(item) {
				const $item = createWizardItem(item);
				$container.append($item);
			});
			
			// Check for scroll overflow to show fade gradient
			checkWizardItemsOverflow();
			
		}, 150); // Brief delay for skeleton visibility
	}

	/**
	 * Show loading skeleton in wizard items
	 */
	function showWizardLoadingSkeleton() {
		const $container = elements.wizardItems;
		$container.empty();
		
		// Generate 4 skeleton items
		for (var i = 0; i < 4; i++) {
			$container.append(
				'<div class="aisales-wizard__skeleton">' +
					'<div class="aisales-wizard__skeleton-image"></div>' +
					'<div class="aisales-wizard__skeleton-content">' +
						'<div class="aisales-wizard__skeleton-line aisales-wizard__skeleton-line--title"></div>' +
						'<div class="aisales-wizard__skeleton-line aisales-wizard__skeleton-line--meta"></div>' +
					'</div>' +
				'</div>'
			);
		}
	}

	/**
	 * Check if wizard items container has overflow (to show fade gradient)
	 */
	function checkWizardItemsOverflow() {
		const $wrapper = elements.wizardItems.parent();
		const container = elements.wizardItems[0];
		
		if (container && container.scrollHeight > container.clientHeight) {
			$wrapper.addClass('has-overflow');
		} else {
			$wrapper.removeClass('has-overflow');
		}
		
		// Update on scroll
		elements.wizardItems.off('scroll.wizardOverflow').on('scroll.wizardOverflow', function() {
			const scrollBottom = container.scrollHeight - container.scrollTop - container.clientHeight;
			if (scrollBottom < 10) {
				$wrapper.removeClass('has-overflow');
			} else {
				$wrapper.addClass('has-overflow');
			}
		});
	}

	/**
	 * Create a wizard item element
	 */
	function createWizardItem(item) {
		const isProduct = state.wizardTask === 'product';
		const name = isProduct ? item.title : item.name;
		const image = isProduct ? item.image : (item.thumbnail || '');
		const subtitle = isProduct 
			? (item.price ? item.price : '') 
			: (item.count !== undefined ? item.count + ' ' + (item.count === 1 ? 'product' : 'products') : '');
		
		// Handle category depth indentation via CSS margin instead of HTML entities
		const depthClass = (!isProduct && item.depth) ? ' aisales-wizard__item--depth-' + Math.min(item.depth, 3) : '';
		
		const $item = $('<button type="button" class="aisales-wizard__item' + depthClass + '">')
			.data('id', item.id)
			.data('entity', item)
			.data('name', name); // Store name for search highlighting
		
		// Image/icon with task-aware variant
		if (image) {
			$item.append('<img class="aisales-wizard__item-image" src="' + escapeHtml(image) + '" alt="">');
		} else {
			const icon = isProduct ? 'dashicons-products' : 'dashicons-category';
			const iconVariant = isProduct ? 'aisales-wizard__item-icon--product' : 'aisales-wizard__item-icon--category';
			$item.append('<span class="aisales-wizard__item-icon ' + iconVariant + '"><span class="dashicons ' + icon + '"></span></span>');
		}
		
		// Content
		const $content = $('<div class="aisales-wizard__item-content">');
		$content.append('<span class="aisales-wizard__item-name">' + escapeHtml(name) + '</span>');
		
		if (subtitle) {
			// Add icon prefix to meta
			const metaIcon = isProduct ? 'dashicons-tag' : 'dashicons-archive';
			$content.append(
				'<span class="aisales-wizard__item-meta">' +
					'<span class="dashicons ' + metaIcon + '"></span>' +
					escapeHtml(subtitle) +
				'</span>'
			);
		}
		$item.append($content);
		
		// Arrow
		$item.append('<span class="aisales-wizard__item-arrow"><span class="dashicons dashicons-arrow-right-alt2"></span></span>');
		
		return $item;
	}

	/**
	 * Filter wizard items based on search
	 */
	function filterWizardItems() {
		const query = elements.wizardSearch.val().toLowerCase().trim();
		const $items = elements.wizardItems.find('.aisales-wizard__item');
		const isProduct = state.wizardTask === 'product';
		
		// Remove existing results count
		$('.aisales-wizard__results-count').remove();
		$('.aisales-wizard__no-results').remove();
		
		if (!query) {
			// Show all items, restore original names (remove highlight)
			$items.each(function() {
				const $item = $(this);
				const originalName = $item.data('name');
				$item.find('.aisales-wizard__item-name').html(escapeHtml(originalName));
			});
			$items.show();
			checkWizardItemsOverflow();
			return;
		}
		
		var visibleCount = 0;
		
		$items.each(function() {
			const $item = $(this);
			const entity = $item.data('entity');
			const name = (isProduct ? entity.title : entity.name) || '';
			const nameLower = name.toLowerCase();
			const matches = nameLower.indexOf(query) !== -1;
			
			if (matches) {
				visibleCount++;
				$item.show();
				
				// Highlight matching text
				const highlightedName = highlightSearchMatch(name, query);
				$item.find('.aisales-wizard__item-name').html(highlightedName);
			} else {
				$item.hide();
				// Restore original name
				$item.find('.aisales-wizard__item-name').html(escapeHtml(name));
			}
		});
		
		// Show results count or no results message
		if (visibleCount > 0) {
			const itemType = isProduct 
				? (visibleCount === 1 ? 'product' : 'products')
				: (visibleCount === 1 ? 'category' : 'categories');
			const resultsHtml = 
				'<div class="aisales-wizard__results-count">' +
					'<span class="dashicons dashicons-search"></span>' +
					visibleCount + ' ' + itemType + ' found' +
				'</div>';
			elements.wizardItems.prepend(resultsHtml);
		} else {
			const noResultsHtml = 
				'<div class="aisales-wizard__no-results">' +
					'<div class="aisales-wizard__no-results-icon">&#128269;</div>' +
					'<p class="aisales-wizard__no-results-text">' +
						'No ' + (isProduct ? 'products' : 'categories') + ' match "<strong>' + escapeHtml(query) + '</strong>"' +
					'</p>' +
				'</div>';
			elements.wizardItems.append(noResultsHtml);
		}
		
		checkWizardItemsOverflow();
	}

	// highlightSearchMatch moved to utils.js module

	/**
	 * Select an entity from the wizard (complete Step 2)
	 */
	function selectWizardEntity(entityId, entityData) {
		if (state.wizardTask === 'product') {
			selectProduct(entityData);
			updateBreadcrumb('product', entityData.title);
		} else {
			selectCategory(entityData);
			updateBreadcrumb('category', entityData.name);
		}
		
		// Save to localStorage for session persistence
		localStorage.setItem('aisales_wizard_session', JSON.stringify({
			task: state.wizardTask,
			entityId: entityId,
			timestamp: Date.now()
		}));
		
		completeWizard();
	}

	/**
	 * Complete the wizard and show the chat interface
	 */
	function completeWizard() {
		state.wizardComplete = true;
		state.wizardStep = 3;
		
		// Update step indicators to show completion
		elements.wizardSteps.each(function() {
			const $step = $(this);
			const stepNum = parseInt($step.data('step'), 10);
			$step.removeClass('aisales-wizard__step--active');
			if (stepNum <= 3) {
				$step.addClass('aisales-wizard__step--completed');
			}
		});
		
		// Hide wizard with animation
		hideWizard();
		
		// Show breadcrumb
		if (state.wizardTask !== 'agent') {
			elements.breadcrumb.show();
		}
	}

	/**
	 * Show the wizard overlay
	 */
	function showWizard() {
		// Reset to step 1 if starting fresh
		if (!state.wizardTask) {
			goToWizardStep(1);
		}
		
		elements.wizard.show();
		elements.breadcrumb.hide();
		
		// Focus search if on step 2
		if (state.wizardStep === 2) {
			setTimeout(function() {
				elements.wizardSearch.focus();
			}, 100);
		}
	}

	/**
	 * Hide the wizard overlay
	 */
	function hideWizard() {
		elements.wizard.hide();
		
		// Show breadcrumb if wizard was completed
		if (state.wizardComplete && state.wizardTask !== 'agent') {
			elements.breadcrumb.show();
		}
	}

	/**
	 * Update the breadcrumb display
	 */
	function updateBreadcrumb(type, name) {
		const typeLabels = {
			'product': aisalesChat.i18n.product || 'Product',
			'category': aisalesChat.i18n.category || 'Category',
			'agent': aisalesChat.i18n.agent || 'Marketing Agent'
		};
		
		elements.breadcrumbType.text(typeLabels[type] || type);
		elements.breadcrumbName.text(name || '');
		
		if (type === 'agent') {
			elements.breadcrumb.hide();
		}
	}

	/**
	 * Reset wizard to initial state (for New Chat)
	 */
	function resetWizard() {
		state.wizardStep = 1;
		state.wizardTask = null;
		state.wizardComplete = false;
		
		// Reset step indicators
		elements.wizardSteps.removeClass('aisales-wizard__step--active aisales-wizard__step--completed');
		$('.aisales-wizard__step[data-step="1"]').addClass('aisales-wizard__step--active');
		
		// Reset panels
		elements.wizardPanels.removeClass('aisales-wizard__panel--active');
		$('.aisales-wizard__panel[data-panel="1"]').addClass('aisales-wizard__panel--active');
		
		// Clear search
		elements.wizardSearch.val('');
		elements.wizardItems.empty();
		
		// Clear localStorage
		localStorage.removeItem('aisales_wizard_session');
		
		// Hide breadcrumb
		elements.breadcrumb.hide();
	}

	// debounce moved to utils.js module (referenced via const wrapper at top)

	// Expose functions needed by modules
	app.selectProduct = selectProduct;
	app.selectCategory = selectCategory;
	app.selectAgent = selectAgent;
	app.updateEntityTabs = updateEntityTabs;
	app.openContextPanel = openContextPanel;
	app.showNotice = showNotice;
	// Expose functions needed by modules - use messaging module if available
	app.sendMessage = function(content, quickAction) {
		if (app.messaging) {
			return app.messaging.sendMessage(content, quickAction);
		}
		return sendMessage(content, quickAction);
	};
	app.createSession = function(entity, entityType) {
		if (app.messaging) {
			return app.messaging.createSession(entity, entityType);
		}
		return createSession(entity, entityType);
	};
	app.enableInputs = enableInputs;
	app.disableInputs = disableInputs;
	app.clearMessages = function() {
		return app.ui.clearMessages();
	};
	app.showWelcomeMessage = function() {
		return app.ui.showWelcomeMessage();
	};
	app.addMessage = function(message, isStreaming) {
		return app.ui.addMessage(message, isStreaming);
	};
	app.showThinking = function() {
		return app.ui.showThinking();
	};
	app.hideThinking = function() {
		return app.ui.hideThinking();
	};
	app.setLoading = setLoading;
	app.scrollToBottom = function() {
		return app.ui.scrollToBottom();
	};
	app.showNotice = function(message, type) {
		return app.ui.showNotice(message, type);
	};
	app.addErrorMessage = function(text) {
		return app.ui.addErrorMessage(text);
	};
	app.renderMessages = function() {
		return app.ui.renderMessages();
	};
	app.updateStreamingMessage = function(content) {
		return app.ui.updateStreamingMessage(content);
	};
	app.updateTokensUsed = function(tokens) {
		return app.ui.updateTokensUsed(tokens);
	};
	app.updateBalance = function(change) {
		return app.ui.updateBalance(change);
	};
	app.handleError = function(xhr) {
		return app.ui.handleError(xhr);
	};
	app.autoResizeTextarea = function() {
		return app.ui.autoResizeTextarea();
	};
	
	// Expose suggestion functions - delegating to suggestions module
	app.handleSuggestionReceived = function(suggestion) {
		return app.suggestions.handleSuggestionReceived(suggestion);
	};
	app.updatePendingSummary = function() {
		return app.suggestions.updatePendingSummary();
	};
	app.renderSuggestionInMessage = function(suggestion, $container) {
		return app.suggestions.renderSuggestionInMessage(suggestion, $container);
	};
	app.showPendingChange = function(suggestion) {
		return app.suggestions.showPendingChange(suggestion);
	};
	app.renderCatalogSuggestion = function(suggestion) {
		return app.suggestions.renderCatalogSuggestion(suggestion);
	};
	app.showResearchConfirmation = function(data) {
		return app.suggestions.showResearchConfirmation(data);
	};
	// Image functions - delegating to images module
	app.showImageGeneratingIndicator = function(prompt) {
		return app.images.showImageGeneratingIndicator(prompt);
	};
	app.hideImageGeneratingIndicator = function() {
		return app.images.hideImageGeneratingIndicator();
	};
	app.appendGeneratedImage = function(data) {
		return app.images.appendGeneratedImage(data);
	};
	app.showImageGenerationModal = function(entityType) {
		return app.images.showImageGenerationModal(entityType);
	};

	// Initialize when DOM is ready
	$(document).ready(init);

})(jQuery);
