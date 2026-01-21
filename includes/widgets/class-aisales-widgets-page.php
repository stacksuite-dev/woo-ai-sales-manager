<?php
/**
 * Widgets Page Controller
 *
 * Admin page for managing and documenting all AI Sales widgets/shortcodes.
 * Provides live previews, shortcode builders, and settings management.
 *
 * @package AISales_Sales_Manager
 */

defined( 'ABSPATH' ) || exit;

/**
 * Widgets Page class
 */
class AISales_Widgets_Page {

	/**
	 * Single instance
	 *
	 * @var AISales_Widgets_Page
	 */
	private static $instance = null;

	/**
	 * Widget definitions
	 *
	 * @var array
	 */
	private $widgets = array();

	/**
	 * Get instance
	 *
	 * @return AISales_Widgets_Page
	 */
	public static function instance() {
		if ( is_null( self::$instance ) ) {
			self::$instance = new self();
		}
		return self::$instance;
	}

	/**
	 * Constructor
	 */
	private function __construct() {
		add_action( 'admin_menu', array( $this, 'add_submenu_page' ), 30 );
		add_action( 'admin_enqueue_scripts', array( $this, 'enqueue_scripts' ) );

		// AJAX handlers.
		add_action( 'wp_ajax_aisales_toggle_widget', array( $this, 'ajax_toggle_widget' ) );
		add_action( 'wp_ajax_aisales_save_widget_settings', array( $this, 'ajax_save_widget_settings' ) );
	}

	/**
	 * Get widget definitions (lazy-loaded to defer translation calls until init)
	 *
	 * @return array
	 */
	public function get_widgets() {
		if ( empty( $this->widgets ) ) {
			$this->define_widgets();
		}
		return $this->widgets;
	}

	/**
	 * Define all available widgets
	 */
	private function define_widgets() {
		$this->widgets = array(
			// Social Proof Widgets.
			'total_sold'       => array(
				'name'        => __( 'Sales Counter', 'ai-sales-manager-for-woocommerce' ),
				'description' => __( 'Display total units sold for any product to build social proof.', 'ai-sales-manager-for-woocommerce' ),
				'shortcode'   => 'aisales_total_sold',
				'category'    => 'social_proof',
				'icon'        => 'dashicons-chart-bar',
				'attributes'  => array(
					'product_id' => array(
						'type'        => 'number',
						'default'     => '',
						'description' => __( 'Product ID (auto-detects on product pages)', 'ai-sales-manager-for-woocommerce' ),
					),
					'format'     => array(
						'type'        => 'text',
						'default'     => '{count} sold',
						'description' => __( 'Display format. Use {count} as placeholder.', 'ai-sales-manager-for-woocommerce' ),
					),
					'show_icon'  => array(
						'type'        => 'boolean',
						'default'     => true,
						'description' => __( 'Show cart icon', 'ai-sales-manager-for-woocommerce' ),
					),
				),
				'preview'     => array(
					'icon'  => 'dashicons-cart',
					'value' => '1,247',
					'label' => 'sold',
				),
			),
			'recent_purchase'  => array(
				'name'        => __( 'Recent Purchase', 'ai-sales-manager-for-woocommerce' ),
				'description' => __( 'Show recent purchase notifications as popups or inline to create urgency.', 'ai-sales-manager-for-woocommerce' ),
				'shortcode'   => 'aisales_recent_purchase',
				'category'    => 'social_proof',
				'icon'        => 'dashicons-megaphone',
				'attributes'  => array(
					'limit'         => array(
						'type'        => 'number',
						'default'     => 5,
						'description' => __( 'Number of recent purchases to rotate', 'ai-sales-manager-for-woocommerce' ),
					),
					'display'       => array(
						'type'        => 'select',
						'default'     => 'popup',
						'options'     => array( 'popup', 'inline' ),
						'description' => __( 'Display as popup toast or inline', 'ai-sales-manager-for-woocommerce' ),
					),
					'show_location' => array(
						'type'        => 'boolean',
						'default'     => true,
						'description' => __( 'Show buyer location', 'ai-sales-manager-for-woocommerce' ),
					),
				),
				'preview'     => array(
					'icon'    => 'dashicons-admin-users',
					'name'    => 'Sarah',
					'location' => 'New York',
					'time'    => '2 min ago',
				),
			),
			'live_viewers'     => array(
				'name'        => __( 'Live Viewers', 'ai-sales-manager-for-woocommerce' ),
				'description' => __( 'Show real-time visitor count to create social proof and urgency.', 'ai-sales-manager-for-woocommerce' ),
				'shortcode'   => 'aisales_live_viewers',
				'category'    => 'social_proof',
				'icon'        => 'dashicons-visibility',
				'attributes'  => array(
					'product_id' => array(
						'type'        => 'number',
						'default'     => '',
						'description' => __( 'Product ID (auto-detects on product pages)', 'ai-sales-manager-for-woocommerce' ),
					),
					'format'     => array(
						'type'        => 'text',
						'default'     => '{count} people viewing',
						'description' => __( 'Display format', 'ai-sales-manager-for-woocommerce' ),
					),
				),
				'preview'     => array(
					'icon'  => 'dashicons-visibility',
					'value' => '24',
					'label' => 'people viewing',
				),
			),
			'stock_urgency'    => array(
				'name'        => __( 'Stock Urgency', 'ai-sales-manager-for-woocommerce' ),
				'description' => __( 'Display low stock warnings to create purchase urgency.', 'ai-sales-manager-for-woocommerce' ),
				'shortcode'   => 'aisales_stock_urgency',
				'category'    => 'social_proof',
				'icon'        => 'dashicons-warning',
				'attributes'  => array(
					'threshold' => array(
						'type'        => 'number',
						'default'     => 10,
						'description' => __( 'Show warning when stock is at or below', 'ai-sales-manager-for-woocommerce' ),
					),
					'format'    => array(
						'type'        => 'text',
						'default'     => 'Only {count} left!',
						'description' => __( 'Warning message format', 'ai-sales-manager-for-woocommerce' ),
					),
				),
				'preview'     => array(
					'icon'   => 'dashicons-warning',
					'value'  => 'Only 3 left!',
					'urgent' => true,
				),
			),
			'review_summary'   => array(
				'name'        => __( 'Review Summary', 'ai-sales-manager-for-woocommerce' ),
				'description' => __( 'Show aggregated review stats with star ratings and highlights.', 'ai-sales-manager-for-woocommerce' ),
				'shortcode'   => 'aisales_review_summary',
				'category'    => 'social_proof',
				'icon'        => 'dashicons-star-filled',
				'attributes'  => array(
					'product_id'   => array(
						'type'        => 'number',
						'default'     => '',
						'description' => __( 'Product ID', 'ai-sales-manager-for-woocommerce' ),
					),
					'show_count'   => array(
						'type'        => 'boolean',
						'default'     => true,
						'description' => __( 'Show review count', 'ai-sales-manager-for-woocommerce' ),
					),
					'show_breakdown' => array(
						'type'        => 'boolean',
						'default'     => false,
						'description' => __( 'Show rating breakdown', 'ai-sales-manager-for-woocommerce' ),
					),
				),
				'preview'     => array(
					'icon'   => 'dashicons-star-filled',
					'rating' => 4.8,
					'count'  => 127,
				),
			),

			// Conversion Widgets.
			'shipping_bar'     => array(
				'name'        => __( 'Free Shipping Bar', 'ai-sales-manager-for-woocommerce' ),
				'description' => __( 'Progress bar showing how much more to spend for free shipping.', 'ai-sales-manager-for-woocommerce' ),
				'shortcode'   => 'aisales_shipping_bar',
				'category'    => 'conversion',
				'icon'        => 'dashicons-car',
				'attributes'  => array(
					'threshold' => array(
						'type'        => 'number',
						'default'     => 0,
						'description' => __( 'Free shipping minimum (0 = use WooCommerce setting)', 'ai-sales-manager-for-woocommerce' ),
					),
					'message'   => array(
						'type'        => 'text',
						'default'     => 'Add {amount} more for FREE shipping!',
						'description' => __( 'Message when threshold not met', 'ai-sales-manager-for-woocommerce' ),
					),
					'success'   => array(
						'type'        => 'text',
						'default'     => 'You qualify for FREE shipping!',
						'description' => __( 'Message when threshold met', 'ai-sales-manager-for-woocommerce' ),
					),
				),
				'preview'     => array(
					'icon'     => 'dashicons-car',
					'progress' => 65,
					'message'  => 'Add $17.50 more for FREE shipping!',
				),
			),
			'countdown'        => array(
				'name'        => __( 'Countdown Timer', 'ai-sales-manager-for-woocommerce' ),
				'description' => __( 'Create urgency with sale or offer expiration countdown.', 'ai-sales-manager-for-woocommerce' ),
				'shortcode'   => 'aisales_countdown',
				'category'    => 'conversion',
				'icon'        => 'dashicons-clock',
				'attributes'  => array(
					'end_date' => array(
						'type'        => 'datetime',
						'default'     => '',
						'description' => __( 'Countdown end date/time', 'ai-sales-manager-for-woocommerce' ),
					),
					'style'    => array(
						'type'        => 'select',
						'default'     => 'flip',
						'options'     => array( 'flip', 'simple', 'minimal' ),
						'description' => __( 'Timer display style', 'ai-sales-manager-for-woocommerce' ),
					),
					'message'  => array(
						'type'        => 'text',
						'default'     => 'Sale ends in:',
						'description' => __( 'Message above timer', 'ai-sales-manager-for-woocommerce' ),
					),
				),
				'preview'     => array(
					'icon'    => 'dashicons-clock',
					'hours'   => 23,
					'minutes' => 45,
					'seconds' => 12,
				),
			),
			'price_drop'       => array(
				'name'        => __( 'Price Drop Badge', 'ai-sales-manager-for-woocommerce' ),
				'description' => __( 'Highlight price reductions with eye-catching badges.', 'ai-sales-manager-for-woocommerce' ),
				'shortcode'   => 'aisales_price_drop',
				'category'    => 'conversion',
				'icon'        => 'dashicons-tag',
				'attributes'  => array(
					'product_id'      => array(
						'type'        => 'number',
						'default'     => '',
						'description' => __( 'Product ID', 'ai-sales-manager-for-woocommerce' ),
					),
					'show_percentage' => array(
						'type'        => 'boolean',
						'default'     => true,
						'description' => __( 'Show percentage saved', 'ai-sales-manager-for-woocommerce' ),
					),
					'style'           => array(
						'type'        => 'select',
						'default'     => 'badge',
						'options'     => array( 'badge', 'ribbon', 'inline' ),
						'description' => __( 'Badge display style', 'ai-sales-manager-for-woocommerce' ),
					),
				),
				'preview'     => array(
					'icon'       => 'dashicons-tag',
					'original'   => '$99',
					'sale'       => '$79',
					'percentage' => '20%',
				),
			),
			'bundle_savings'   => array(
				'name'        => __( 'Bundle Savings', 'ai-sales-manager-for-woocommerce' ),
				'description' => __( 'Show multi-buy discounts and bundle savings calculator.', 'ai-sales-manager-for-woocommerce' ),
				'shortcode'   => 'aisales_bundle_savings',
				'category'    => 'conversion',
				'icon'        => 'dashicons-products',
				'attributes'  => array(
					'product_id' => array(
						'type'        => 'number',
						'default'     => '',
						'description' => __( 'Product ID', 'ai-sales-manager-for-woocommerce' ),
					),
					'format'     => array(
						'type'        => 'text',
						'default'     => 'Buy {qty}, save {amount}!',
						'description' => __( 'Savings message format', 'ai-sales-manager-for-woocommerce' ),
					),
				),
				'preview'     => array(
					'icon'    => 'dashicons-products',
					'message' => 'Buy 3, save $15!',
				),
			),
			'cart_urgency'     => array(
				'name'        => __( 'Cart Urgency', 'ai-sales-manager-for-woocommerce' ),
				'description' => __( 'Show cart reservation timer to prevent abandonment.', 'ai-sales-manager-for-woocommerce' ),
				'shortcode'   => 'aisales_cart_urgency',
				'category'    => 'conversion',
				'icon'        => 'dashicons-backup',
				'attributes'  => array(
					'duration' => array(
						'type'        => 'number',
						'default'     => 15,
						'description' => __( 'Reservation time in minutes', 'ai-sales-manager-for-woocommerce' ),
					),
					'message'  => array(
						'type'        => 'text',
						'default'     => 'Items reserved for {time}',
						'description' => __( 'Urgency message', 'ai-sales-manager-for-woocommerce' ),
					),
				),
				'preview'     => array(
					'icon'    => 'dashicons-backup',
					'message' => 'Items reserved for 14:32',
				),
			),

			// Discovery Widgets.
			'bestsellers'      => array(
				'name'        => __( 'Best Sellers', 'ai-sales-manager-for-woocommerce' ),
				'description' => __( 'Display top-selling products to guide purchase decisions.', 'ai-sales-manager-for-woocommerce' ),
				'shortcode'   => 'aisales_bestsellers',
				'category'    => 'discovery',
				'icon'        => 'dashicons-awards',
				'attributes'  => array(
					'limit'    => array(
						'type'        => 'number',
						'default'     => 4,
						'description' => __( 'Number of products', 'ai-sales-manager-for-woocommerce' ),
					),
					'category' => array(
						'type'        => 'text',
						'default'     => '',
						'description' => __( 'Filter by category slug', 'ai-sales-manager-for-woocommerce' ),
					),
					'layout'   => array(
						'type'        => 'select',
						'default'     => 'grid',
						'options'     => array( 'grid', 'carousel', 'list' ),
						'description' => __( 'Display layout', 'ai-sales-manager-for-woocommerce' ),
					),
				),
				'preview'     => array(
					'icon'  => 'dashicons-awards',
					'type'  => 'products',
					'count' => 4,
				),
			),
			'trending'         => array(
				'name'        => __( 'Trending Now', 'ai-sales-manager-for-woocommerce' ),
				'description' => __( 'Show products with high recent sales velocity.', 'ai-sales-manager-for-woocommerce' ),
				'shortcode'   => 'aisales_trending',
				'category'    => 'discovery',
				'icon'        => 'dashicons-chart-line',
				'attributes'  => array(
					'limit'  => array(
						'type'        => 'number',
						'default'     => 4,
						'description' => __( 'Number of products', 'ai-sales-manager-for-woocommerce' ),
					),
					'period' => array(
						'type'        => 'select',
						'default'     => '7days',
						'options'     => array( '24hours', '7days', '30days' ),
						'description' => __( 'Trending period', 'ai-sales-manager-for-woocommerce' ),
					),
				),
				'preview'     => array(
					'icon'  => 'dashicons-chart-line',
					'type'  => 'products',
					'count' => 4,
					'badge' => 'Trending',
				),
			),
			'recently_viewed'  => array(
				'name'        => __( 'Recently Viewed', 'ai-sales-manager-for-woocommerce' ),
				'description' => __( 'Show products the customer has recently browsed.', 'ai-sales-manager-for-woocommerce' ),
				'shortcode'   => 'aisales_recently_viewed',
				'category'    => 'discovery',
				'icon'        => 'dashicons-backup',
				'attributes'  => array(
					'limit'           => array(
						'type'        => 'number',
						'default'     => 4,
						'description' => __( 'Number of products', 'ai-sales-manager-for-woocommerce' ),
					),
					'exclude_current' => array(
						'type'        => 'boolean',
						'default'     => true,
						'description' => __( 'Exclude current product', 'ai-sales-manager-for-woocommerce' ),
					),
				),
				'preview'     => array(
					'icon'  => 'dashicons-backup',
					'type'  => 'products',
					'count' => 4,
				),
			),
			'bought_together'  => array(
				'name'        => __( 'Bought Together', 'ai-sales-manager-for-woocommerce' ),
				'description' => __( 'Display products frequently purchased together.', 'ai-sales-manager-for-woocommerce' ),
				'shortcode'   => 'aisales_bought_together',
				'category'    => 'discovery',
				'icon'        => 'dashicons-networking',
				'attributes'  => array(
					'product_id' => array(
						'type'        => 'number',
						'default'     => '',
						'description' => __( 'Product ID', 'ai-sales-manager-for-woocommerce' ),
					),
					'limit'      => array(
						'type'        => 'number',
						'default'     => 3,
						'description' => __( 'Number of suggestions', 'ai-sales-manager-for-woocommerce' ),
					),
				),
				'preview'     => array(
					'icon'  => 'dashicons-networking',
					'type'  => 'products',
					'count' => 3,
					'label' => 'Frequently bought together',
				),
			),
			'new_arrivals'     => array(
				'name'        => __( 'New Arrivals', 'ai-sales-manager-for-woocommerce' ),
				'description' => __( 'Showcase recently added products to your store.', 'ai-sales-manager-for-woocommerce' ),
				'shortcode'   => 'aisales_new_arrivals',
				'category'    => 'discovery',
				'icon'        => 'dashicons-star-empty',
				'attributes'  => array(
					'limit'    => array(
						'type'        => 'number',
						'default'     => 4,
						'description' => __( 'Number of products', 'ai-sales-manager-for-woocommerce' ),
					),
					'days'     => array(
						'type'        => 'number',
						'default'     => 30,
						'description' => __( 'Products added within X days', 'ai-sales-manager-for-woocommerce' ),
					),
					'category' => array(
						'type'        => 'text',
						'default'     => '',
						'description' => __( 'Filter by category slug', 'ai-sales-manager-for-woocommerce' ),
					),
				),
				'preview'     => array(
					'icon'  => 'dashicons-star-empty',
					'type'  => 'products',
					'count' => 4,
					'badge' => 'New',
				),
			),
		);
	}

	/**
	 * Get widgets by category
	 *
	 * @param string $category Category slug.
	 * @return array
	 */
	public function get_widgets_by_category( $category ) {
		return array_filter(
			$this->get_widgets(),
			function( $widget ) use ( $category ) {
				return $widget['category'] === $category;
			}
		);
	}

	/**
	 * Get widget categories
	 *
	 * @return array
	 */
	public function get_categories() {
		return array(
			'social_proof' => array(
				'name'        => __( 'Social Proof', 'ai-sales-manager-for-woocommerce' ),
				'description' => __( 'Build trust and create urgency with social proof elements', 'ai-sales-manager-for-woocommerce' ),
				'icon'        => 'dashicons-groups',
			),
			'conversion'   => array(
				'name'        => __( 'Conversion', 'ai-sales-manager-for-woocommerce' ),
				'description' => __( 'Optimize for sales with conversion-focused widgets', 'ai-sales-manager-for-woocommerce' ),
				'icon'        => 'dashicons-chart-area',
			),
			'discovery'    => array(
				'name'        => __( 'Discovery', 'ai-sales-manager-for-woocommerce' ),
				'description' => __( 'Help customers discover relevant products', 'ai-sales-manager-for-woocommerce' ),
				'icon'        => 'dashicons-search',
			),
		);
	}

	/**
	 * Get widget settings
	 *
	 * @return array
	 */
	public function get_settings() {
		$defaults = array(
			'enabled_widgets'  => array_keys( $this->widgets ),
			'cache_duration'   => 3600,
			'styling_mode'     => 'inherit',
			'colors'           => array(
				'primary' => '#2271b1',
				'success' => '#00a32a',
				'urgency' => '#d63638',
				'text'    => '#1d2327',
			),
			'social_proof'     => array(
				'privacy_level'  => 'first_city',
				'popup_position' => 'bottom-left',
				'popup_duration' => 5,
			),
			'conversion'       => array(
				'shipping_threshold' => 0,
				'stock_urgency_at'   => 10,
			),
		);

		$saved = get_option( 'aisales_widgets_settings', array() );

		return wp_parse_args( $saved, $defaults );
	}

	/**
	 * Add submenu page under AI Sales Manager
	 */
	public function add_submenu_page() {
		add_submenu_page(
			'ai-sales-manager',
			__( 'Widgets', 'ai-sales-manager-for-woocommerce' ),
			__( 'Widgets', 'ai-sales-manager-for-woocommerce' ),
			'manage_woocommerce',
			'ai-sales-widgets',
			array( $this, 'render_page' )
		);
	}

	/**
	 * Enqueue scripts and styles
	 *
	 * @param string $hook The current admin page.
	 */
	public function enqueue_scripts( $hook ) {
		if ( 'ai-sales-manager_page_ai-sales-widgets' !== $hook ) {
			return;
		}

		// CSS version.
		$css_file    = AISALES_PLUGIN_DIR . 'assets/css/widgets-page.css';
		$css_version = ( defined( 'WP_DEBUG' ) && WP_DEBUG && file_exists( $css_file ) )
			? filemtime( $css_file )
			: AISALES_VERSION;

		// Enqueue page styles.
		wp_enqueue_style(
			'aisales-widgets-page',
			AISALES_PLUGIN_URL . 'assets/css/widgets-page.css',
			array( 'aisales-admin' ),
			$css_version
		);

		// JS version.
		$js_file    = AISALES_PLUGIN_DIR . 'assets/js/widgets-page.js';
		$js_version = ( defined( 'WP_DEBUG' ) && WP_DEBUG && file_exists( $js_file ) )
			? filemtime( $js_file )
			: AISALES_VERSION;

		// Enqueue page script.
		wp_enqueue_script(
			'aisales-widgets-page',
			AISALES_PLUGIN_URL . 'assets/js/widgets-page.js',
			array( 'jquery' ),
			$js_version,
			true
		);

		// Localize script.
		wp_localize_script(
			'aisales-widgets-page',
			'aisalesWidgets',
			array(
				'ajaxUrl'    => admin_url( 'admin-ajax.php' ),
				'nonce'      => wp_create_nonce( 'aisales_nonce' ),
				'widgets'    => $this->widgets,
				'categories' => $this->get_categories(),
				'settings'   => $this->get_settings(),
				'i18n'       => array(
					'copied'         => __( 'Copied!', 'ai-sales-manager-for-woocommerce' ),
					'copyShortcode'  => __( 'Copy Shortcode', 'ai-sales-manager-for-woocommerce' ),
					'openBuilder'    => __( 'Customize', 'ai-sales-manager-for-woocommerce' ),
					'enabled'        => __( 'Enabled', 'ai-sales-manager-for-woocommerce' ),
					'disabled'       => __( 'Disabled', 'ai-sales-manager-for-woocommerce' ),
					'saving'         => __( 'Saving...', 'ai-sales-manager-for-woocommerce' ),
					'saved'          => __( 'Settings saved!', 'ai-sales-manager-for-woocommerce' ),
					'error'          => __( 'Error saving settings', 'ai-sales-manager-for-woocommerce' ),
				),
			)
		);
	}

	/**
	 * Render the page
	 */
	public function render_page() {
		$settings   = $this->get_settings();
		$categories = $this->get_categories();

		include AISALES_PLUGIN_DIR . 'templates/admin-widgets-page.php';
	}

	/**
	 * AJAX handler for toggling widget enabled state
	 */
	public function ajax_toggle_widget() {
		check_ajax_referer( 'aisales_nonce', 'nonce' );

		if ( ! current_user_can( 'manage_woocommerce' ) ) {
			wp_send_json_error( array( 'message' => __( 'Permission denied.', 'ai-sales-manager-for-woocommerce' ) ) );
		}

		$widget  = isset( $_POST['widget'] ) ? sanitize_key( $_POST['widget'] ) : '';
		$enabled = isset( $_POST['enabled'] ) && '1' === $_POST['enabled'];

		if ( empty( $widget ) || ! isset( $this->widgets[ $widget ] ) ) {
			wp_send_json_error( array( 'message' => __( 'Invalid widget.', 'ai-sales-manager-for-woocommerce' ) ) );
		}

		$settings = $this->get_settings();

		if ( $enabled ) {
			// Add to enabled widgets if not already there.
			if ( ! in_array( $widget, $settings['enabled_widgets'], true ) ) {
				$settings['enabled_widgets'][] = $widget;
			}
		} else {
			// Remove from enabled widgets.
			$settings['enabled_widgets'] = array_values(
				array_diff( $settings['enabled_widgets'], array( $widget ) )
			);
		}

		update_option( 'aisales_widgets_settings', $settings );

		wp_send_json_success(
			array(
				'message'       => $enabled
					? __( 'Widget enabled.', 'ai-sales-manager-for-woocommerce' )
					: __( 'Widget disabled.', 'ai-sales-manager-for-woocommerce' ),
				'enabled_count' => count( $settings['enabled_widgets'] ),
			)
		);
	}

	/**
	 * AJAX handler for saving widget settings
	 */
	public function ajax_save_widget_settings() {
		check_ajax_referer( 'aisales_nonce', 'nonce' );

		if ( ! current_user_can( 'manage_woocommerce' ) ) {
			wp_send_json_error( array( 'message' => __( 'Permission denied.', 'ai-sales-manager-for-woocommerce' ) ) );
		}

		$settings_json = isset( $_POST['settings'] ) ? wp_unslash( $_POST['settings'] ) : '';
		$new_settings  = json_decode( $settings_json, true );

		if ( ! is_array( $new_settings ) ) {
			wp_send_json_error( array( 'message' => __( 'Invalid settings data.', 'ai-sales-manager-for-woocommerce' ) ) );
		}

		// Get current settings to preserve enabled_widgets.
		$current_settings = $this->get_settings();

		// Sanitize and merge settings.
		$sanitized = array(
			'enabled_widgets' => $current_settings['enabled_widgets'], // Preserve enabled widgets.
			'cache_duration'  => isset( $new_settings['cache_duration'] )
				? absint( $new_settings['cache_duration'] )
				: 3600,
			'styling_mode'    => isset( $new_settings['styling_mode'] ) && in_array( $new_settings['styling_mode'], array( 'inherit', 'custom' ), true )
				? $new_settings['styling_mode']
				: 'inherit',
			'colors'          => array(
				'primary' => isset( $new_settings['colors']['primary'] )
					? sanitize_hex_color( $new_settings['colors']['primary'] )
					: '#2271b1',
				'success' => isset( $new_settings['colors']['success'] )
					? sanitize_hex_color( $new_settings['colors']['success'] )
					: '#00a32a',
				'urgency' => isset( $new_settings['colors']['urgency'] )
					? sanitize_hex_color( $new_settings['colors']['urgency'] )
					: '#d63638',
				'text'    => isset( $new_settings['colors']['text'] )
					? sanitize_hex_color( $new_settings['colors']['text'] )
					: '#1d2327',
			),
			'social_proof'    => array(
				'privacy_level'  => isset( $new_settings['social_proof']['privacy_level'] ) && in_array( $new_settings['social_proof']['privacy_level'], array( 'full', 'first_city', 'city_only', 'anonymous' ), true )
					? $new_settings['social_proof']['privacy_level']
					: 'first_city',
				'popup_position' => isset( $new_settings['social_proof']['popup_position'] ) && in_array( $new_settings['social_proof']['popup_position'], array( 'bottom-left', 'bottom-right', 'top-left', 'top-right' ), true )
					? $new_settings['social_proof']['popup_position']
					: 'bottom-left',
				'popup_duration' => isset( $new_settings['social_proof']['popup_duration'] )
					? min( 15, max( 1, absint( $new_settings['social_proof']['popup_duration'] ) ) )
					: 5,
			),
			'conversion'      => array(
				'shipping_threshold' => isset( $new_settings['conversion']['shipping_threshold'] )
					? floatval( $new_settings['conversion']['shipping_threshold'] )
					: 0,
				'stock_urgency_at'   => isset( $new_settings['conversion']['stock_urgency_at'] )
					? absint( $new_settings['conversion']['stock_urgency_at'] )
					: 10,
			),
		);

		update_option( 'aisales_widgets_settings', $sanitized );

		wp_send_json_success(
			array(
				'message' => __( 'Settings saved successfully.', 'ai-sales-manager-for-woocommerce' ),
			)
		);
	}
}
