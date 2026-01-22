<?php
/**
 * AJAX Loader
 *
 * Loads and initializes all AJAX handler classes.
 *
 * @package AISales_Sales_Manager
 * @since 1.3.0
 */

defined( 'ABSPATH' ) || exit;

/**
 * AJAX Loader class
 */
class AISales_Ajax_Loader {

	/**
	 * Single instance
	 *
	 * @var AISales_Ajax_Loader
	 */
	private static $instance = null;

	/**
	 * Loaded handler instances
	 *
	 * @var array
	 */
	private $handlers = array();

	/**
	 * Handler class names
	 *
	 * @var array
	 */
	private $handler_classes = array(
		'auth'     => 'AISales_Ajax_Auth',
		'billing'  => 'AISales_Ajax_Billing',
		'ai'       => 'AISales_Ajax_AI',
		'products' => 'AISales_Ajax_Products',
		'email'    => 'AISales_Ajax_Email',
		'support'  => 'AISales_Ajax_Support',
		'brand'    => 'AISales_Ajax_Brand',
		'store'    => 'AISales_Ajax_Store',
	);

	/**
	 * Get instance
	 *
	 * @return AISales_Ajax_Loader
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
		$this->load_dependencies();
		$this->init_handlers();
	}

	/**
	 * Load handler class files
	 */
	private function load_dependencies() {
		$ajax_dir = AISALES_PLUGIN_DIR . 'includes/ajax/';

		// Load base class first
		require_once $ajax_dir . 'class-aisales-ajax-base.php';

		// Load all handler classes
		require_once $ajax_dir . 'class-aisales-ajax-auth.php';
		require_once $ajax_dir . 'class-aisales-ajax-billing.php';
		require_once $ajax_dir . 'class-aisales-ajax-ai.php';
		require_once $ajax_dir . 'class-aisales-ajax-products.php';
		require_once $ajax_dir . 'class-aisales-ajax-email.php';
		require_once $ajax_dir . 'class-aisales-ajax-support.php';
		require_once $ajax_dir . 'class-aisales-ajax-brand.php';
		require_once $ajax_dir . 'class-aisales-ajax-store.php';
	}

	/**
	 * Initialize all handler instances
	 */
	private function init_handlers() {
		foreach ( $this->handler_classes as $key => $class_name ) {
			if ( class_exists( $class_name ) ) {
				$this->handlers[ $key ] = new $class_name();
			}
		}
	}

	/**
	 * Get a specific handler instance
	 *
	 * @param string $handler Handler key.
	 * @return AISales_Ajax_Base|null Handler instance or null.
	 */
	public function get_handler( $handler ) {
		return isset( $this->handlers[ $handler ] ) ? $this->handlers[ $handler ] : null;
	}

	/**
	 * Get all loaded handlers
	 *
	 * @return array Handler instances.
	 */
	public function get_handlers() {
		return $this->handlers;
	}
}
