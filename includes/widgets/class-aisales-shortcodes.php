<?php
/**
 * Shortcodes Manager
 *
 * Registers and handles all AI Sales shortcodes for the frontend.
 *
 * @package AISales_Sales_Manager
 */

defined( 'ABSPATH' ) || exit;

// Load shortcode traits.
require_once __DIR__ . '/trait-aisales-shortcodes-social-proof.php';
require_once __DIR__ . '/trait-aisales-shortcodes-conversion.php';
require_once __DIR__ . '/trait-aisales-shortcodes-discovery.php';

/**
 * Shortcodes class
 */
class AISales_Shortcodes {

	// Use category-specific traits for render methods.
	use AISales_Shortcodes_Social_Proof;
	use AISales_Shortcodes_Conversion;
	use AISales_Shortcodes_Discovery;

	/**
	 * Single instance
	 *
	 * @var AISales_Shortcodes
	 */
	private static $instance = null;

	/**
	 * Whether frontend assets have been enqueued
	 *
	 * @var bool
	 */
	private $assets_enqueued = false;

	/**
	 * Get instance
	 *
	 * @return AISales_Shortcodes
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
		$this->register_shortcodes();
		add_action( 'wp_enqueue_scripts', array( $this, 'register_frontend_assets' ) );
	}

	/**
	 * Register all shortcodes
	 */
	private function register_shortcodes() {
		// Social Proof.
		add_shortcode( 'aisales_total_sold', array( $this, 'render_total_sold' ) );
		add_shortcode( 'aisales_stock_urgency', array( $this, 'render_stock_urgency' ) );
		add_shortcode( 'aisales_review_summary', array( $this, 'render_review_summary' ) );
		add_shortcode( 'aisales_recent_purchase', array( $this, 'render_recent_purchase' ) );
		add_shortcode( 'aisales_live_viewers', array( $this, 'render_live_viewers' ) );

		// Conversion.
		add_shortcode( 'aisales_countdown', array( $this, 'render_countdown' ) );
		add_shortcode( 'aisales_price_drop', array( $this, 'render_price_drop' ) );
		add_shortcode( 'aisales_bundle_savings', array( $this, 'render_bundle_savings' ) );
		add_shortcode( 'aisales_cart_urgency', array( $this, 'render_cart_urgency' ) );
		add_shortcode( 'aisales_shipping_bar', array( $this, 'render_shipping_bar' ) );

		// Discovery.
		add_shortcode( 'aisales_bestsellers', array( $this, 'render_bestsellers' ) );
		add_shortcode( 'aisales_trending', array( $this, 'render_trending' ) );
		add_shortcode( 'aisales_recently_viewed', array( $this, 'render_recently_viewed' ) );
		add_shortcode( 'aisales_bought_together', array( $this, 'render_bought_together' ) );
		add_shortcode( 'aisales_new_arrivals', array( $this, 'render_new_arrivals' ) );
	}

	/**
	 * Register frontend assets (loaded only when shortcode is used)
	 */
	public function register_frontend_assets() {
		$css_file    = AISALES_PLUGIN_DIR . 'assets/css/shortcodes.css';
		$css_version = ( defined( 'WP_DEBUG' ) && WP_DEBUG && file_exists( $css_file ) )
			? filemtime( $css_file )
			: AISALES_VERSION;

		wp_register_style(
			'aisales-shortcodes',
			AISALES_PLUGIN_URL . 'assets/css/shortcodes.css',
			array(),
			$css_version
		);

		$js_file    = AISALES_PLUGIN_DIR . 'assets/js/shortcodes.js';
		$js_version = ( defined( 'WP_DEBUG' ) && WP_DEBUG && file_exists( $js_file ) )
			? filemtime( $js_file )
			: AISALES_VERSION;

		wp_register_script(
			'aisales-shortcodes',
			AISALES_PLUGIN_URL . 'assets/js/shortcodes.js',
			array( 'jquery' ),
			$js_version,
			true
		);
	}

	/**
	 * Enqueue frontend assets (called when a shortcode is rendered)
	 */
	private function enqueue_assets() {
		if ( $this->assets_enqueued ) {
			return;
		}
		wp_enqueue_style( 'aisales-shortcodes' );
		wp_enqueue_script( 'aisales-shortcodes' );
		$this->assets_enqueued = true;
	}

	/**
	 * Get product ID from shortcode attributes or current context
	 *
	 * @param array $atts Shortcode attributes.
	 * @return int|false Product ID or false if not found.
	 */
	private function get_product_id( $atts ) {
		// Explicit product_id attribute.
		if ( ! empty( $atts['product_id'] ) ) {
			return absint( $atts['product_id'] );
		}

		// Auto-detect from current product page.
		global $product;
		if ( $product && is_a( $product, 'WC_Product' ) ) {
			return $product->get_id();
		}

		// Try get_queried_object for single product pages.
		if ( is_singular( 'product' ) ) {
			return get_queried_object_id();
		}

		return false;
	}

	/**
	 * Get product object
	 *
	 * @param int $product_id Product ID.
	 * @return WC_Product|false Product object or false.
	 */
	private function get_product( $product_id ) {
		if ( ! $product_id || ! function_exists( 'wc_get_product' ) ) {
			return false;
		}
		return wc_get_product( $product_id );
	}

	/**
	 * Format number with locale-aware separators
	 *
	 * @param int    $number Number to format.
	 * @param string $format Format type: 'formatted', 'compact', or 'raw'.
	 * @return string Formatted number.
	 */
	private function format_number( $number, $format = 'formatted' ) {
		switch ( $format ) {
			case 'compact':
				if ( $number >= 1000000 ) {
					return round( $number / 1000000, 1 ) . 'M';
				} elseif ( $number >= 1000 ) {
					return round( $number / 1000, 1 ) . 'K';
				}
				return (string) $number;

			case 'raw':
				return (string) $number;

			case 'formatted':
			default:
				return number_format_i18n( $number );
		}
	}

	/**
	 * Get widget configuration from widgets page
	 *
	 * Retrieves saved config and merges with defaults. Works both in admin
	 * (when AISales_Widgets_Page is available) and frontend (direct option read).
	 *
	 * @param string $widget_key Widget key.
	 * @return array Widget config with defaults.
	 */
	private function get_widget_config( $widget_key ) {
		// Define defaults for each widget type.
		$defaults = $this->get_widget_defaults( $widget_key );

		// Get saved config from option.
		$all_config   = get_option( 'aisales_widget_config', array() );
		$saved_config = isset( $all_config[ $widget_key ] ) ? $all_config[ $widget_key ] : array();

		return wp_parse_args( $saved_config, $defaults );
	}

	/**
	 * Get default configuration values for a widget
	 *
	 * @param string $widget_key Widget key.
	 * @return array Default config values.
	 */
	private function get_widget_defaults( $widget_key ) {
		$defaults = array(
			'total_sold'      => array(
				'margin_top'         => 10,
				'margin_bottom'      => 10,
				'show_icon'          => true,
				'icon_style'         => 'cart',
				'custom_class'       => '',
				'text_color'         => '',
				'bg_color'           => '',
				'icon_color'         => '',
				'format'             => '{count} sold',
				'min_to_show'        => 1,
				'number_format'      => 'formatted',
				'animate'            => false,
				'cache_duration'     => 'global',
				'exclude_products'   => '',
				'exclude_categories' => '',
			),
			'stock_urgency'   => array(
				'margin_top'         => 10,
				'margin_bottom'      => 10,
				'show_icon'          => true,
				'animation'          => true,
				'custom_class'       => '',
				'threshold_low'      => 10,
				'threshold_warning'  => 5,
				'threshold_critical' => 2,
				'format_low'         => 'Only {count} left in stock',
				'format_warning'     => 'Hurry! Only {count} left!',
				'format_critical'    => 'Almost gone! Only {count} left!',
				'exclude_backorder'  => true,
				'exclude_products'   => '',
			),
			'review_summary'  => array(
				'margin_top'       => 10,
				'margin_bottom'    => 10,
				'show_count'       => true,
				'show_breakdown'   => false,
				'min_reviews'      => 1,
				'star_color'       => '#f59e0b',
				'text_color'       => '',
				'custom_class'     => '',
				'exclude_products' => '',
			),
			'price_drop'      => array(
				'margin_top'       => 10,
				'margin_bottom'    => 10,
				'show_percentage'  => true,
				'show_amount'      => false,
				'style'            => 'badge',
				'format'           => 'Save {percent}!',
				'min_discount'     => 5,
				'text_color'       => '',
				'bg_color'         => '',
				'custom_class'     => '',
				'exclude_products' => '',
			),
			'new_arrivals'    => array(
				'margin_top'         => 20,
				'margin_bottom'      => 20,
				'limit'              => 4,
				'columns'            => 4,
				'days'               => 30,
				'category'           => '',
				'layout'             => 'grid',
				'show_title'         => true,
				'show_price'         => true,
				'show_rating'        => true,
				'show_badge'         => true,
				'badge_text'         => 'New',
				'title_text'         => 'New Arrivals',
				'show_section_title' => true,
				'custom_class'       => '',
			),
			'bestsellers'     => array(
				'margin_top'         => 20,
				'margin_bottom'      => 20,
				'limit'              => 4,
				'columns'            => 4,
				'category'           => '',
				'layout'             => 'grid',
				'show_title'         => true,
				'show_price'         => true,
				'show_rating'        => true,
				'show_badge'         => true,
				'badge_text'         => 'Best Seller',
				'title_text'         => 'Best Sellers',
				'show_section_title' => true,
				'custom_class'       => '',
			),
			'trending'        => array(
				'margin_top'         => 20,
				'margin_bottom'      => 20,
				'limit'              => 4,
				'columns'            => 4,
				'period'             => '7days',
				'category'           => '',
				'layout'             => 'grid',
				'show_title'         => true,
				'show_price'         => true,
				'show_rating'        => true,
				'show_badge'         => true,
				'badge_text'         => 'Trending',
				'title_text'         => 'Trending Now',
				'show_section_title' => true,
				'custom_class'       => '',
			),
			'countdown'       => array(
				'margin_top'       => 10,
				'margin_bottom'    => 10,
				'style'            => 'inline',
				'format'           => 'Sale ends in {timer}',
				'end_action'       => 'hide',
				'show_days'        => true,
				'show_hours'       => true,
				'show_minutes'     => true,
				'show_seconds'     => true,
				'text_color'       => '',
				'bg_color'         => '',
				'accent_color'     => '#dc2626',
				'custom_class'     => '',
				'exclude_products' => '',
			),
			'recently_viewed' => array(
				'margin_top'         => 20,
				'margin_bottom'      => 20,
				'limit'              => 4,
				'columns'            => 4,
				'layout'             => 'grid',
				'exclude_current'    => true,
				'show_title'         => true,
				'show_price'         => true,
				'show_rating'        => true,
				'show_badge'         => true,
				'badge_text'         => 'Viewed',
				'title_text'         => 'Recently Viewed',
				'show_section_title' => true,
				'custom_class'       => '',
			),
			'bought_together' => array(
				'margin_top'         => 20,
				'margin_bottom'      => 20,
				'limit'              => 4,
				'columns'            => 4,
				'layout'             => 'grid',
				'exclude_current'    => true,
				'show_title'         => true,
				'show_price'         => true,
				'show_rating'        => true,
				'show_badge'         => true,
				'badge_text'         => 'Bundle',
				'title_text'         => 'Frequently Bought Together',
				'show_section_title' => true,
				'custom_class'       => '',
			),
			'bundle_savings'  => array(
				'margin_top'       => 10,
				'margin_bottom'    => 10,
				'format'           => 'Buy {qty}, save {amount} ({percent}%)',
				'tiers'            => "2:5\n3:10\n4:15",
				'text_color'       => '',
				'bg_color'         => '',
				'custom_class'     => '',
				'exclude_products' => '',
			),
			'cart_urgency'    => array(
				'margin_top'    => 10,
				'margin_bottom' => 10,
				'duration'      => 15,
				'format'        => 'Items reserved for {time}',
				'end_action'    => 'hide',
				'show_hours'    => true,
				'show_minutes'  => true,
				'show_seconds'  => true,
				'text_color'    => '',
				'bg_color'      => '',
				'accent_color'  => '#e65100',
				'custom_class'  => '',
			),
			'recent_purchase' => array(
				'margin_top'     => 0,
				'margin_bottom'  => 0,
				'position'       => 'bottom-left',
				'show_image'     => true,
				'privacy_level'  => 'first_city',
				'show_location'  => true,
				'limit'          => 5,
				'interval'       => 8,
				'duration'       => 5,
				'animation'      => 'slide',
				'custom_class'   => '',
				'include_guests' => true,
			),
			'live_viewers'    => array(
				'margin_top'       => 10,
				'margin_bottom'    => 10,
				'format'           => '{count} people are viewing this product',
				'min_to_show'      => 1,
				'max_viewers'      => 25,
				'refresh_interval' => 12,
				'text_color'       => '',
				'bg_color'         => '',
				'accent_color'     => '#2563eb',
				'custom_class'     => '',
			),
			'shipping_bar'    => array(
				'margin_top'    => 10,
				'margin_bottom' => 10,
				'threshold'     => 0,
				'bar_color'     => '#22c55e',
				'bg_color'      => '#e5e7eb',
				'text_color'    => '',
				'message'       => 'Add {amount} more for FREE shipping!',
				'success'       => 'You qualify for FREE shipping!',
				'custom_class'  => '',
			),
		);

		return isset( $defaults[ $widget_key ] ) ? $defaults[ $widget_key ] : array();
	}

	/**
	 * Build margin style string from config
	 *
	 * @param array $config Widget config.
	 * @return string CSS style string.
	 */
	private function build_margin_style( $config ) {
		$margin_top    = isset( $config['margin_top'] ) ? absint( $config['margin_top'] ) : 10;
		$margin_bottom = isset( $config['margin_bottom'] ) ? absint( $config['margin_bottom'] ) : 10;

		return sprintf( 'margin-top: %dpx; margin-bottom: %dpx;', $margin_top, $margin_bottom );
	}

	/**
	 * Render wrapper for shortcode output
	 *
	 * @param string $shortcode Shortcode name.
	 * @param string $content   Inner content.
	 * @param array  $classes   Additional CSS classes.
	 * @param string $style     Inline CSS styles.
	 * @return string HTML output.
	 */
	private function wrap_output( $shortcode, $content, $classes = array(), $style = '' ) {
		$this->enqueue_assets();

		$base_class = 'aisales-widget aisales-' . str_replace( '_', '-', $shortcode );
		if ( ! empty( $classes ) ) {
			$base_class .= ' ' . implode( ' ', $classes );
		}

		$style_attr = '';
		if ( ! empty( $style ) ) {
			$style_attr = sprintf( ' style="%s"', esc_attr( $style ) );
		}

		return sprintf(
			'<div class="%s"%s>%s</div>',
			esc_attr( $base_class ),
			$style_attr,
			$content
		);
	}
}
