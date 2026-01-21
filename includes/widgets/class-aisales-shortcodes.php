<?php
/**
 * Shortcodes Manager
 *
 * Registers and handles all AI Sales shortcodes for the frontend.
 *
 * @package AISales_Sales_Manager
 */

defined( 'ABSPATH' ) || exit;

/**
 * Shortcodes class
 */
class AISales_Shortcodes {

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

		// Conversion.
		add_shortcode( 'aisales_countdown', array( $this, 'render_countdown' ) );
		add_shortcode( 'aisales_price_drop', array( $this, 'render_price_drop' ) );
		add_shortcode( 'aisales_bundle_savings', array( $this, 'render_bundle_savings' ) );
		add_shortcode( 'aisales_cart_urgency', array( $this, 'render_cart_urgency' ) );

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
			'total_sold'    => array(
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
			'stock_urgency' => array(
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

	/* =========================================================================
	   SOCIAL PROOF SHORTCODES
	   ========================================================================= */

	/**
	 * Render [aisales_total_sold] shortcode
	 *
	 * Displays total units sold for a product.
	 *
	 * @param array $atts Shortcode attributes.
	 * @return string HTML output.
	 */
	public function render_total_sold( $atts ) {
		// Get saved widget configuration.
		$config = $this->get_widget_config( 'total_sold' );

		// Shortcode attributes with config defaults.
		$atts = shortcode_atts(
			array(
				'product_id' => '',
				'format'     => isset( $config['format'] ) ? $config['format'] : '{count} sold',
				'show_icon'  => isset( $config['show_icon'] ) ? ( $config['show_icon'] ? 'true' : 'false' ) : 'true',
			),
			$atts,
			'aisales_total_sold'
		);

		$product_id = $this->get_product_id( $atts );
		if ( ! $product_id ) {
			return '';
		}

		// Check exclusions.
		$exclude_products = isset( $config['exclude_products'] ) ? $config['exclude_products'] : '';
		if ( ! empty( $exclude_products ) ) {
			$excluded_ids = array_map( 'absint', array_filter( explode( ',', $exclude_products ) ) );
			if ( in_array( $product_id, $excluded_ids, true ) ) {
				return '';
			}
		}

		$product = $this->get_product( $product_id );
		if ( ! $product ) {
			return '';
		}

		// Check category exclusions.
		$exclude_categories = isset( $config['exclude_categories'] ) ? $config['exclude_categories'] : '';
		if ( ! empty( $exclude_categories ) ) {
			$excluded_cats  = array_map( 'trim', explode( ',', $exclude_categories ) );
			$product_cats   = wp_get_post_terms( $product_id, 'product_cat', array( 'fields' => 'slugs' ) );
			$product_cats   = is_array( $product_cats ) ? $product_cats : array();
			$intersect      = array_intersect( $excluded_cats, $product_cats );
			if ( ! empty( $intersect ) ) {
				return '';
			}
		}

		// Get total sales count.
		$total_sold = $product->get_total_sales();

		// Check minimum to show threshold.
		$min_to_show = isset( $config['min_to_show'] ) ? absint( $config['min_to_show'] ) : 1;
		if ( $total_sold < $min_to_show ) {
			return '';
		}

		// Format the number based on config.
		$number_format   = isset( $config['number_format'] ) ? $config['number_format'] : 'formatted';
		$formatted_count = $this->format_number( $total_sold, $number_format );
		$text            = str_replace( '{count}', $formatted_count, $atts['format'] );

		$show_icon = filter_var( $atts['show_icon'], FILTER_VALIDATE_BOOLEAN );

		// Get icon style.
		$icon_style = isset( $config['icon_style'] ) ? $config['icon_style'] : 'cart';
		$icons      = array(
			'cart'  => '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="16" height="16"><path d="M7 18c-1.1 0-1.99.9-1.99 2S5.9 22 7 22s2-.9 2-2-.9-2-2-2zM1 2v2h2l3.6 7.59-1.35 2.45c-.16.28-.25.61-.25.96 0 1.1.9 2 2 2h12v-2H7.42c-.14 0-.25-.11-.25-.25l.03-.12.9-1.63h7.45c.75 0 1.41-.41 1.75-1.03l3.58-6.49c.08-.14.12-.31.12-.48 0-.55-.45-1-1-1H5.21l-.94-2H1zm16 16c-1.1 0-1.99.9-1.99 2s.89 2 1.99 2 2-.9 2-2-.9-2-2-2z"/></svg>',
			'bag'   => '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="16" height="16"><path d="M18 6h-2c0-2.21-1.79-4-4-4S8 3.79 8 6H6c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zm-6-2c1.1 0 2 .9 2 2h-4c0-1.1.9-2 2-2zm6 16H6V8h2v2c0 .55.45 1 1 1s1-.45 1-1V8h4v2c0 .55.45 1 1 1s1-.45 1-1V8h2v12z"/></svg>',
			'chart' => '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="16" height="16"><path d="M5 9.2h3V19H5V9.2zM10.6 5h2.8v14h-2.8V5zm5.6 8H19v6h-2.8v-6z"/></svg>',
			'fire'  => '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="16" height="16"><path d="M13.5.67s.74 2.65.74 4.8c0 2.06-1.35 3.73-3.41 3.73-2.07 0-3.63-1.67-3.63-3.73l.03-.36C5.21 7.51 4 10.62 4 14c0 4.42 3.58 8 8 8s8-3.58 8-8C20 8.61 17.41 3.8 13.5.67zM11.71 19c-1.78 0-3.22-1.4-3.22-3.14 0-1.62 1.05-2.76 2.81-3.12 1.77-.36 3.6-1.21 4.62-2.58.39 1.29.59 2.65.59 4.04 0 2.65-2.15 4.8-4.8 4.8z"/></svg>',
		);

		$content = '';
		if ( $show_icon && isset( $icons[ $icon_style ] ) ) {
			$content .= '<span class="aisales-total-sold__icon">' . $icons[ $icon_style ] . '</span>';
		}

		// Add animation data attribute if enabled.
		$animate = isset( $config['animate'] ) && $config['animate'];
		if ( $animate ) {
			$content .= '<span class="aisales-total-sold__text" data-animate="true" data-count="' . esc_attr( $total_sold ) . '">' . esc_html( $text ) . '</span>';
		} else {
			$content .= '<span class="aisales-total-sold__text">' . esc_html( $text ) . '</span>';
		}

		// Build classes.
		$classes = array();
		$custom_class = isset( $config['custom_class'] ) ? $config['custom_class'] : '';
		if ( ! empty( $custom_class ) ) {
			$classes[] = sanitize_html_class( $custom_class );
		}

		// Build styles (margins + colors).
		$style = $this->build_margin_style( $config );

		// Add color styles - check if keys exist in saved config to determine if user has customized.
		$all_config   = get_option( 'aisales_widget_config', array() );
		$saved_config = isset( $all_config['total_sold'] ) ? $all_config['total_sold'] : array();

		// Apply text color if set.
		if ( ! empty( $config['text_color'] ) ) {
			$style .= 'color:' . esc_attr( $config['text_color'] ) . ';';
		}

		// Apply background color - if key exists in saved config, user has customized it.
		// Empty value means user wants transparent (per help text), so override CSS default.
		if ( array_key_exists( 'bg_color', $saved_config ) ) {
			if ( ! empty( $config['bg_color'] ) ) {
				$style .= 'background-color:' . esc_attr( $config['bg_color'] ) . ';padding:8px 12px;border-radius:6px;';
			} else {
				// User explicitly set empty = transparent background.
				$style .= 'background:transparent;padding:0;';
			}
		}
		// If bg_color not in saved config, CSS defaults apply (no inline override needed).

		// Apply icon color if set.
		if ( ! empty( $config['icon_color'] ) ) {
			$style .= '--aisales-icon-color:' . esc_attr( $config['icon_color'] ) . ';';
		}

		return $this->wrap_output( 'total_sold', $content, $classes, $style );
	}

	/**
	 * Render [aisales_stock_urgency] shortcode
	 *
	 * Displays low stock warning to create urgency.
	 *
	 * @param array $atts Shortcode attributes.
	 * @return string HTML output.
	 */
	public function render_stock_urgency( $atts ) {
		// Get saved widget configuration.
		$config = $this->get_widget_config( 'stock_urgency' );

		// Thresholds from config.
		$threshold_low      = isset( $config['threshold_low'] ) ? absint( $config['threshold_low'] ) : 10;
		$threshold_warning  = isset( $config['threshold_warning'] ) ? absint( $config['threshold_warning'] ) : 5;
		$threshold_critical = isset( $config['threshold_critical'] ) ? absint( $config['threshold_critical'] ) : 2;

		// Shortcode attributes with config defaults.
		$atts = shortcode_atts(
			array(
				'product_id' => '',
				'threshold'  => $threshold_low,
				'format'     => isset( $config['format_low'] ) ? $config['format_low'] : 'Only {count} left in stock!',
			),
			$atts,
			'aisales_stock_urgency'
		);

		$product_id = $this->get_product_id( $atts );
		if ( ! $product_id ) {
			return '';
		}

		// Check product exclusions.
		$exclude_products = isset( $config['exclude_products'] ) ? $config['exclude_products'] : '';
		if ( ! empty( $exclude_products ) ) {
			$excluded_ids = array_map( 'absint', array_filter( explode( ',', $exclude_products ) ) );
			if ( in_array( $product_id, $excluded_ids, true ) ) {
				return '';
			}
		}

		$product = $this->get_product( $product_id );
		if ( ! $product ) {
			return '';
		}

		// Check if product manages stock.
		if ( ! $product->managing_stock() ) {
			return '';
		}

		// Check backorder exclusion.
		$exclude_backorder = isset( $config['exclude_backorder'] ) ? $config['exclude_backorder'] : true;
		if ( $exclude_backorder && $product->backorders_allowed() ) {
			return '';
		}

		$stock_qty = $product->get_stock_quantity();
		$threshold = absint( $atts['threshold'] );

		// Don't show if stock is above threshold or out of stock.
		if ( null === $stock_qty || $stock_qty > $threshold || $stock_qty < 1 ) {
			return '';
		}

		// Determine urgency level and format based on config thresholds.
		$urgency_class = 'aisales-stock-urgency--low';
		$format        = isset( $config['format_low'] ) ? $config['format_low'] : 'Only {count} left in stock';

		if ( $stock_qty <= $threshold_critical ) {
			$urgency_class = 'aisales-stock-urgency--critical';
			$format        = isset( $config['format_critical'] ) ? $config['format_critical'] : 'Almost gone! Only {count} left!';
		} elseif ( $stock_qty <= $threshold_warning ) {
			$urgency_class = 'aisales-stock-urgency--warning';
			$format        = isset( $config['format_warning'] ) ? $config['format_warning'] : 'Hurry! Only {count} left!';
		}

		$text = str_replace( '{count}', $this->format_number( $stock_qty ), $format );

		// Build content.
		$show_icon = isset( $config['show_icon'] ) ? $config['show_icon'] : true;
		$animation = isset( $config['animation'] ) ? $config['animation'] : true;

		$content = '';
		if ( $show_icon ) {
			$content .= '<span class="aisales-stock-urgency__icon">
				<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="16" height="16">
					<path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z"/>
				</svg>
			</span>';
		}
		$content .= '<span class="aisales-stock-urgency__text">' . esc_html( $text ) . '</span>';

		// Build classes.
		$classes = array( $urgency_class );
		if ( $animation && $stock_qty <= $threshold_critical ) {
			$classes[] = 'aisales-stock-urgency--pulse';
		}
		$custom_class = isset( $config['custom_class'] ) ? $config['custom_class'] : '';
		if ( ! empty( $custom_class ) ) {
			$classes[] = sanitize_html_class( $custom_class );
		}

		// Build margin styles.
		$style = $this->build_margin_style( $config );

		return $this->wrap_output( 'stock_urgency', $content, $classes, $style );
	}

	/* =========================================================================
	   PLACEHOLDER SHORTCODES (to be implemented)
	   ========================================================================= */

	/**
	 * Render [aisales_review_summary] shortcode
	 *
	 * @param array $atts Shortcode attributes.
	 * @return string HTML output.
	 */
	public function render_review_summary( $atts ) {
		// TODO: Implement review summary.
		return '';
	}

	/**
	 * Render [aisales_countdown] shortcode
	 *
	 * @param array $atts Shortcode attributes.
	 * @return string HTML output.
	 */
	public function render_countdown( $atts ) {
		// TODO: Implement countdown timer.
		return '';
	}

	/**
	 * Render [aisales_price_drop] shortcode
	 *
	 * @param array $atts Shortcode attributes.
	 * @return string HTML output.
	 */
	public function render_price_drop( $atts ) {
		// TODO: Implement price drop badge.
		return '';
	}

	/**
	 * Render [aisales_bundle_savings] shortcode
	 *
	 * @param array $atts Shortcode attributes.
	 * @return string HTML output.
	 */
	public function render_bundle_savings( $atts ) {
		// TODO: Implement bundle savings.
		return '';
	}

	/**
	 * Render [aisales_cart_urgency] shortcode
	 *
	 * @param array $atts Shortcode attributes.
	 * @return string HTML output.
	 */
	public function render_cart_urgency( $atts ) {
		// TODO: Implement cart urgency.
		return '';
	}

	/**
	 * Render [aisales_bestsellers] shortcode
	 *
	 * @param array $atts Shortcode attributes.
	 * @return string HTML output.
	 */
	public function render_bestsellers( $atts ) {
		// TODO: Implement bestsellers grid.
		return '';
	}

	/**
	 * Render [aisales_trending] shortcode
	 *
	 * @param array $atts Shortcode attributes.
	 * @return string HTML output.
	 */
	public function render_trending( $atts ) {
		// TODO: Implement trending products.
		return '';
	}

	/**
	 * Render [aisales_recently_viewed] shortcode
	 *
	 * @param array $atts Shortcode attributes.
	 * @return string HTML output.
	 */
	public function render_recently_viewed( $atts ) {
		// TODO: Implement recently viewed.
		return '';
	}

	/**
	 * Render [aisales_bought_together] shortcode
	 *
	 * @param array $atts Shortcode attributes.
	 * @return string HTML output.
	 */
	public function render_bought_together( $atts ) {
		// TODO: Implement bought together.
		return '';
	}

	/**
	 * Render [aisales_new_arrivals] shortcode
	 *
	 * @param array $atts Shortcode attributes.
	 * @return string HTML output.
	 */
	public function render_new_arrivals( $atts ) {
		// TODO: Implement new arrivals.
		return '';
	}
}
