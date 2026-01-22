<?php
/**
 * Branding Extractor
 *
 * Auto-detects branding information (colors, fonts, logo) from
 * WordPress theme, WooCommerce settings, and block theme global styles.
 *
 * @package AISales_Sales_Manager
 */

defined( 'ABSPATH' ) || exit;

/**
 * Branding Extractor class
 */
class AISales_Branding_Extractor {

	/**
	 * Single instance
	 *
	 * @var AISales_Branding_Extractor
	 */
	private static $instance = null;

	/**
	 * Common email-safe fonts with fallbacks
	 *
	 * @var array
	 */
	private $safe_fonts = array(
		'system'    => array(
			'label'  => 'System Default',
			'family' => '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen-Sans, Ubuntu, Cantarell, "Helvetica Neue", sans-serif',
		),
		'arial'     => array(
			'label'  => 'Arial',
			'family' => 'Arial, Helvetica, sans-serif',
		),
		'georgia'   => array(
			'label'  => 'Georgia',
			'family' => 'Georgia, "Times New Roman", Times, serif',
		),
		'helvetica' => array(
			'label'  => 'Helvetica',
			'family' => '"Helvetica Neue", Helvetica, Arial, sans-serif',
		),
		'trebuchet' => array(
			'label'  => 'Trebuchet MS',
			'family' => '"Trebuchet MS", Arial, sans-serif',
		),
		'verdana'   => array(
			'label'  => 'Verdana',
			'family' => 'Verdana, Geneva, sans-serif',
		),
		'palatino'  => array(
			'label'  => 'Palatino',
			'family' => '"Palatino Linotype", "Book Antiqua", Palatino, serif',
		),
		'tahoma'    => array(
			'label'  => 'Tahoma',
			'family' => 'Tahoma, Geneva, sans-serif',
		),
	);

	/**
	 * Get instance
	 *
	 * @return AISales_Branding_Extractor
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
	private function __construct() {}

	/**
	 * Get all branding information
	 *
	 * @return array Complete branding data.
	 */
	public function get_branding() {
		return array(
			'colors' => $this->get_colors(),
			'fonts'  => $this->get_fonts(),
			'logo'   => $this->get_logo(),
		);
	}

	/**
	 * Get brand colors from various sources
	 *
	 * Priority: WooCommerce email settings > Theme customizer > Block theme > Defaults
	 *
	 * @return array Color values.
	 */
	public function get_colors() {
		$colors = array(
			'primary'         => '',
			'secondary'       => '',
			'text'            => '',
			'background'      => '',
			'body_background' => '',
			'source'          => 'default',
		);

		// 1. Try WooCommerce email settings first (user explicitly configured for emails)
		$wc_colors = $this->get_woocommerce_colors();
		if ( ! empty( $wc_colors['primary'] ) && '#7f54b3' !== $wc_colors['primary'] ) {
			// WooCommerce colors were customized (not default purple)
			$colors = array_merge( $colors, $wc_colors );
			$colors['source'] = 'woocommerce';
			return $colors;
		}

		// 2. Try block theme global styles (WordPress 5.9+)
		$block_colors = $this->get_block_theme_colors();
		if ( ! empty( $block_colors['primary'] ) ) {
			$colors = array_merge( $colors, $block_colors );
			$colors['source'] = 'block_theme';
			return $colors;
		}

		// 3. Try classic theme customizer
		$theme_colors = $this->get_theme_customizer_colors();
		if ( ! empty( $theme_colors['primary'] ) ) {
			$colors = array_merge( $colors, $theme_colors );
			$colors['source'] = 'theme_customizer';
			return $colors;
		}

		// 4. Fall back to WooCommerce defaults
		$colors = array_merge( $colors, $wc_colors );
		$colors['source'] = 'default';

		return $colors;
	}

	/**
	 * Get WooCommerce email color settings
	 *
	 * @return array WooCommerce colors.
	 */
	private function get_woocommerce_colors() {
		return array(
			'primary'         => get_option( 'woocommerce_email_base_color', '#7f54b3' ),
			'text'            => get_option( 'woocommerce_email_text_color', '#3c3c3c' ),
			'background'      => get_option( 'woocommerce_email_background_color', '#f7f7f7' ),
			'body_background' => get_option( 'woocommerce_email_body_background_color', '#ffffff' ),
		);
	}

	/**
	 * Get colors from block theme global styles
	 *
	 * @return array Block theme colors.
	 */
	private function get_block_theme_colors() {
		$colors = array();

		if ( ! function_exists( 'wp_get_global_settings' ) ) {
			return $colors;
		}

		$settings = wp_get_global_settings();
		$palette  = $settings['color']['palette']['theme'] ?? array();

		// Look for primary/brand colors in the palette
		$priority_slugs = array( 'primary', 'accent', 'brand', 'contrast', 'base' );

		foreach ( $palette as $color ) {
			$slug = $color['slug'] ?? '';
			$hex  = $color['color'] ?? '';

			if ( empty( $hex ) ) {
				continue;
			}

			// Map common slugs to our color keys
			if ( in_array( $slug, array( 'primary', 'accent', 'brand' ), true ) ) {
				$colors['primary'] = $hex;
			} elseif ( in_array( $slug, array( 'secondary', 'contrast' ), true ) && empty( $colors['secondary'] ) ) {
				$colors['secondary'] = $hex;
			} elseif ( in_array( $slug, array( 'foreground', 'text' ), true ) ) {
				$colors['text'] = $hex;
			} elseif ( in_array( $slug, array( 'background', 'base' ), true ) ) {
				$colors['background'] = $hex;
			}
		}

		// If no primary found, use the first non-white/black color
		if ( empty( $colors['primary'] ) && ! empty( $palette ) ) {
			foreach ( $palette as $color ) {
				$hex = strtolower( $color['color'] ?? '' );
				if ( ! empty( $hex ) && ! in_array( $hex, array( '#ffffff', '#fff', '#000000', '#000' ), true ) ) {
					$colors['primary'] = $color['color'];
					break;
				}
			}
		}

		return $colors;
	}

	/**
	 * Get colors from classic theme customizer
	 *
	 * @return array Theme customizer colors.
	 */
	private function get_theme_customizer_colors() {
		$colors = array();

		// Common theme_mod names for primary colors
		$primary_mods = array(
			'primary_color',
			'accent_color',
			'link_color',
			'brand_color',
			'main_color',
			'theme_color',
			'button_bg_color',
			'button_background_color',
		);

		foreach ( $primary_mods as $mod ) {
			$value = get_theme_mod( $mod );
			if ( $this->is_valid_hex_color( $value ) ) {
				$colors['primary'] = $value;
				break;
			}
		}

		// Secondary color mods
		$secondary_mods = array(
			'secondary_color',
			'accent_color_2',
			'link_hover_color',
		);

		foreach ( $secondary_mods as $mod ) {
			$value = get_theme_mod( $mod );
			if ( $this->is_valid_hex_color( $value ) && $value !== ( $colors['primary'] ?? '' ) ) {
				$colors['secondary'] = $value;
				break;
			}
		}

		// Text color mods
		$text_mods = array(
			'text_color',
			'body_text_color',
			'content_text_color',
		);

		foreach ( $text_mods as $mod ) {
			$value = get_theme_mod( $mod );
			if ( $this->is_valid_hex_color( $value ) ) {
				$colors['text'] = $value;
				break;
			}
		}

		// Background color
		$bg_color = get_background_color();
		if ( $bg_color ) {
			$colors['background'] = '#' . ltrim( $bg_color, '#' );
		}

		return $colors;
	}

	/**
	 * Get all color theme mods (for debugging/discovery)
	 *
	 * @return array All theme mods that look like colors.
	 */
	public function get_all_color_mods() {
		$mods       = get_theme_mods();
		$color_mods = array();

		if ( ! is_array( $mods ) ) {
			return $color_mods;
		}

		foreach ( $mods as $key => $value ) {
			if ( $this->is_valid_hex_color( $value ) ) {
				$color_mods[ $key ] = $value;
			}
		}

		return $color_mods;
	}

	/**
	 * Get font settings
	 *
	 * @return array Font data.
	 */
	public function get_fonts() {
		$fonts = array(
			'heading'      => '',
			'body'         => '',
			'heading_slug' => 'system',
			'body_slug'    => 'system',
			'source'       => 'default',
			'available'    => $this->safe_fonts,
		);

		// 1. Try block theme typography
		$block_fonts = $this->get_block_theme_fonts();
		if ( ! empty( $block_fonts['body'] ) ) {
			$fonts = array_merge( $fonts, $block_fonts );
			$fonts['available'] = $this->safe_fonts;
			return $fonts;
		}

		// 2. Try theme customizer fonts
		$theme_fonts = $this->get_theme_customizer_fonts();
		if ( ! empty( $theme_fonts['body'] ) ) {
			$fonts = array_merge( $fonts, $theme_fonts );
			$fonts['available'] = $this->safe_fonts;
			return $fonts;
		}

		// 3. Default to system font
		$fonts['body']         = $this->safe_fonts['system']['family'];
		$fonts['heading']      = $this->safe_fonts['system']['family'];
		$fonts['body_slug']    = 'system';
		$fonts['heading_slug'] = 'system';
		$fonts['source']       = 'default';
		$fonts['available']    = $this->safe_fonts;

		return $fonts;
	}

	/**
	 * Get fonts from block theme global styles
	 *
	 * @return array Block theme fonts.
	 */
	private function get_block_theme_fonts() {
		$fonts = array();

		if ( ! function_exists( 'wp_get_global_settings' ) ) {
			return $fonts;
		}

		$settings     = wp_get_global_settings();
		$font_families = $settings['typography']['fontFamilies']['theme'] ?? array();

		foreach ( $font_families as $font ) {
			$slug   = $font['slug'] ?? '';
			$family = $font['fontFamily'] ?? '';

			if ( empty( $family ) ) {
				continue;
			}

			// Try to match to a safe email font
			$matched_slug = $this->match_to_safe_font( $family );

			if ( in_array( $slug, array( 'body', 'base', 'primary' ), true ) ) {
				$fonts['body']      = $matched_slug ? $this->safe_fonts[ $matched_slug ]['family'] : $this->safe_fonts['system']['family'];
				$fonts['body_slug'] = $matched_slug ?: 'system';
				$fonts['source']    = 'block_theme';
			} elseif ( in_array( $slug, array( 'heading', 'display', 'secondary' ), true ) ) {
				$fonts['heading']      = $matched_slug ? $this->safe_fonts[ $matched_slug ]['family'] : $this->safe_fonts['system']['family'];
				$fonts['heading_slug'] = $matched_slug ?: 'system';
			}
		}

		// If only body found, use it for heading too
		if ( ! empty( $fonts['body'] ) && empty( $fonts['heading'] ) ) {
			$fonts['heading']      = $fonts['body'];
			$fonts['heading_slug'] = $fonts['body_slug'];
		}

		return $fonts;
	}

	/**
	 * Get fonts from theme customizer
	 *
	 * @return array Theme customizer fonts.
	 */
	private function get_theme_customizer_fonts() {
		$fonts = array();

		// Common font theme_mods
		$body_mods = array(
			'body_font',
			'body_font_family',
			'base_font',
			'base_typography_font_family',
			'typography_body_font',
		);

		foreach ( $body_mods as $mod ) {
			$value = get_theme_mod( $mod );
			if ( ! empty( $value ) && is_string( $value ) ) {
				$matched_slug = $this->match_to_safe_font( $value );
				$fonts['body']      = $matched_slug ? $this->safe_fonts[ $matched_slug ]['family'] : $this->safe_fonts['system']['family'];
				$fonts['body_slug'] = $matched_slug ?: 'system';
				$fonts['source']    = 'theme_customizer';
				break;
			}
		}

		$heading_mods = array(
			'heading_font',
			'heading_font_family',
			'headings_font',
			'typography_heading_font',
		);

		foreach ( $heading_mods as $mod ) {
			$value = get_theme_mod( $mod );
			if ( ! empty( $value ) && is_string( $value ) ) {
				$matched_slug = $this->match_to_safe_font( $value );
				$fonts['heading']      = $matched_slug ? $this->safe_fonts[ $matched_slug ]['family'] : $this->safe_fonts['system']['family'];
				$fonts['heading_slug'] = $matched_slug ?: 'system';
				break;
			}
		}

		return $fonts;
	}

	/**
	 * Match a font family string to a safe email font
	 *
	 * @param string $font_family Font family string.
	 * @return string|null Matched safe font slug or null.
	 */
	private function match_to_safe_font( $font_family ) {
		$font_lower = strtolower( $font_family );

		foreach ( $this->safe_fonts as $slug => $data ) {
			// Check if the font family contains the safe font name
			$check_name = strtolower( $data['label'] );
			if ( strpos( $font_lower, $check_name ) !== false ) {
				return $slug;
			}
		}

		// Check for serif vs sans-serif to suggest appropriate default
		if ( strpos( $font_lower, 'serif' ) !== false && strpos( $font_lower, 'sans' ) === false ) {
			return 'georgia'; // Default serif
		}

		return null; // Will default to system
	}

	/**
	 * Get logo information
	 *
	 * @return array Logo data.
	 */
	public function get_logo() {
		$logo = array(
			'url'       => '',
			'source'    => '',
			'site_name' => get_bloginfo( 'name' ),
		);

		// 1. WooCommerce email header image (highest priority for emails)
		$wc_logo = get_option( 'woocommerce_email_header_image', '' );
		if ( ! empty( $wc_logo ) ) {
			$logo['url']    = $wc_logo;
			$logo['source'] = 'woocommerce_email';
			return $logo;
		}

		// 2. WordPress custom logo
		$custom_logo_id = get_theme_mod( 'custom_logo' );
		if ( $custom_logo_id ) {
			$logo_url = wp_get_attachment_image_url( $custom_logo_id, 'medium' );
			if ( $logo_url ) {
				$logo['url']    = $logo_url;
				$logo['source'] = 'custom_logo';
				return $logo;
			}
		}

		// 3. Site icon (fallback)
		$site_icon = get_site_icon_url( 256 );
		if ( $site_icon ) {
			$logo['url']    = $site_icon;
			$logo['source'] = 'site_icon';
			return $logo;
		}

		return $logo;
	}

	/**
	 * Get available safe fonts for dropdown
	 *
	 * @return array Safe fonts array.
	 */
	public function get_safe_fonts() {
		return $this->safe_fonts;
	}

	/**
	 * Check if a value is a valid hex color
	 *
	 * @param mixed $value Value to check.
	 * @return bool True if valid hex color.
	 */
	private function is_valid_hex_color( $value ) {
		if ( ! is_string( $value ) ) {
			return false;
		}
		return (bool) preg_match( '/^#[a-fA-F0-9]{3,6}$/', $value );
	}

	/**
	 * Generate a secondary color from primary (if needed)
	 *
	 * @param string $primary Primary color hex.
	 * @return string Secondary color hex.
	 */
	public function generate_secondary_color( $primary ) {
		if ( empty( $primary ) ) {
			return '#3c3c3c';
		}

		// Darken the primary color by 20%
		return $this->adjust_brightness( $primary, -20 );
	}

	/**
	 * Adjust color brightness
	 *
	 * @param string $hex    Hex color.
	 * @param int    $steps  Steps to adjust (-255 to 255).
	 * @return string Adjusted hex color.
	 */
	public function adjust_brightness( $hex, $steps ) {
		$hex = ltrim( $hex, '#' );

		// Convert to RGB
		$r = hexdec( substr( $hex, 0, 2 ) );
		$g = hexdec( substr( $hex, 2, 2 ) );
		$b = hexdec( substr( $hex, 4, 2 ) );

		// Adjust
		$r = max( 0, min( 255, $r + $steps ) );
		$g = max( 0, min( 255, $g + $steps ) );
		$b = max( 0, min( 255, $b + $steps ) );

		return sprintf( '#%02x%02x%02x', $r, $g, $b );
	}

	/**
	 * Get contrasting text color (black or white)
	 *
	 * @param string $hex Background color hex.
	 * @return string '#ffffff' or '#000000'.
	 */
	public function get_contrasting_text_color( $hex ) {
		$hex = ltrim( $hex, '#' );

		$r = hexdec( substr( $hex, 0, 2 ) );
		$g = hexdec( substr( $hex, 2, 2 ) );
		$b = hexdec( substr( $hex, 4, 2 ) );

		// Calculate luminance
		$luminance = ( 0.299 * $r + 0.587 * $g + 0.114 * $b ) / 255;

		return $luminance > 0.5 ? '#000000' : '#ffffff';
	}
}
