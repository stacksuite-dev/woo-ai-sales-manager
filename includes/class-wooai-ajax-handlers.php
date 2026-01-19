<?php
/**
 * AJAX Handlers
 *
 * @package WooAI_Sales_Manager
 */

defined( 'ABSPATH' ) || exit;

/**
 * AJAX Handlers class
 */
class WooAI_Ajax_Handlers {

	/**
	 * Single instance
	 *
	 * @var WooAI_Ajax_Handlers
	 */
	private static $instance = null;

	/**
	 * Get instance
	 *
	 * @return WooAI_Ajax_Handlers
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
		// Auth actions (legacy)
		add_action( 'wp_ajax_wooai_login', array( $this, 'handle_login' ) );
		add_action( 'wp_ajax_wooai_register', array( $this, 'handle_register' ) );

		// Auth actions (new domain-based)
		add_action( 'wp_ajax_wooai_connect', array( $this, 'handle_connect' ) );

		// Billing actions
		add_action( 'wp_ajax_wooai_topup', array( $this, 'handle_topup' ) );

		// AI actions
		add_action( 'wp_ajax_wooai_generate_content', array( $this, 'handle_generate_content' ) );
		add_action( 'wp_ajax_wooai_suggest_taxonomy', array( $this, 'handle_suggest_taxonomy' ) );
		add_action( 'wp_ajax_wooai_generate_image', array( $this, 'handle_generate_image' ) );
		add_action( 'wp_ajax_wooai_improve_image', array( $this, 'handle_improve_image' ) );

		// Account actions
		add_action( 'wp_ajax_wooai_get_balance', array( $this, 'handle_get_balance' ) );

		// Chat actions
		add_action( 'wp_ajax_wooai_update_product_field', array( $this, 'handle_update_product_field' ) );
		add_action( 'wp_ajax_wooai_update_category_field', array( $this, 'handle_update_category_field' ) );
		add_action( 'wp_ajax_wooai_get_category', array( $this, 'handle_get_category' ) );

		// Store context actions
		add_action( 'wp_ajax_wooai_save_store_context', array( $this, 'handle_save_store_context' ) );
		add_action( 'wp_ajax_wooai_sync_store_context', array( $this, 'handle_sync_store_context' ) );
		add_action( 'wp_ajax_wooai_mark_chat_visited', array( $this, 'handle_mark_chat_visited' ) );

		// Balance sync action
		add_action( 'wp_ajax_wooai_sync_balance', array( $this, 'handle_sync_balance' ) );

		// Agent mode actions
		add_action( 'wp_ajax_wooai_save_generated_image', array( $this, 'handle_save_generated_image' ) );
		add_action( 'wp_ajax_wooai_get_store_summary', array( $this, 'handle_get_store_summary' ) );

		// Tool calling actions (AI Agent data requests)
		add_action( 'wp_ajax_wooai_fetch_tool_data', array( $this, 'handle_fetch_tool_data' ) );
	}

	/**
	 * Verify nonce and capability.
	 *
	 * Note: wp_send_json_error() calls wp_die() internally, so execution halts
	 * on failure. The return value is only reached on success.
	 *
	 * @return void
	 */
	private function verify_request() {
		if ( ! check_ajax_referer( 'wooai_nonce', 'nonce', false ) ) {
			wp_send_json_error( array( 'message' => __( 'Invalid security token.', 'woo-ai-sales-manager' ) ) );
		}

		if ( ! current_user_can( 'manage_woocommerce' ) ) {
			wp_send_json_error( array( 'message' => __( 'Permission denied.', 'woo-ai-sales-manager' ) ) );
		}
	}

	/**
	 * Verify chat nonce and product editing capability.
	 *
	 * Note: wp_send_json_error() calls wp_die() internally, so execution halts
	 * on failure. The return value is only reached on success.
	 *
	 * @return void
	 */
	private function verify_chat_request() {
		if ( ! check_ajax_referer( 'wooai_chat_nonce', 'nonce', false ) ) {
			wp_send_json_error( array( 'message' => __( 'Invalid security token.', 'woo-ai-sales-manager' ) ) );
		}

		if ( ! current_user_can( 'edit_products' ) ) {
			wp_send_json_error( array( 'message' => __( 'Permission denied.', 'woo-ai-sales-manager' ) ) );
		}
	}

	/**
	 * Verify chat nonce and WooCommerce management capability.
	 *
	 * @return void
	 */
	private function verify_chat_admin_request() {
		if ( ! check_ajax_referer( 'wooai_chat_nonce', 'nonce', false ) ) {
			wp_send_json_error( array( 'message' => __( 'Invalid security token.', 'woo-ai-sales-manager' ) ) );
		}

		if ( ! current_user_can( 'manage_woocommerce' ) ) {
			wp_send_json_error( array( 'message' => __( 'Permission denied.', 'woo-ai-sales-manager' ) ) );
		}
	}

	/**
	 * Get and validate a product from the POST request.
	 *
	 * Retrieves product_id from $_POST, validates it, and returns the WC_Product.
	 * Sends JSON error response and halts execution if validation fails.
	 *
	 * @return WC_Product The validated product object.
	 */
	private function get_validated_product() {
		$product_id = isset( $_POST['product_id'] ) ? absint( $_POST['product_id'] ) : 0;

		if ( ! $product_id ) {
			wp_send_json_error( array( 'message' => __( 'Invalid product.', 'woo-ai-sales-manager' ) ) );
		}

		$product = wc_get_product( $product_id );

		if ( ! $product ) {
			wp_send_json_error( array( 'message' => __( 'Product not found.', 'woo-ai-sales-manager' ) ) );
		}

		return $product;
	}

	/**
	 * Handle login (legacy)
	 *
	 * @deprecated 1.1.0 Use handle_connect() for domain-based authentication instead.
	 */
	public function handle_login() {
		_doing_it_wrong(
			__METHOD__,
			esc_html__( 'Email/password login is deprecated. Use domain-based authentication via handle_connect() instead.', 'woo-ai-sales-manager' ),
			'1.1.0'
		);

		$this->verify_request();

		$email    = isset( $_POST['email'] ) ? sanitize_email( $_POST['email'] ) : '';
		$password = isset( $_POST['password'] ) ? $_POST['password'] : '';

		if ( empty( $email ) || empty( $password ) ) {
			wp_send_json_error( array( 'message' => __( 'Email and password are required.', 'woo-ai-sales-manager' ) ) );
		}

		$api    = WooAI_API_Client::instance();
		$result = $api->login( $email, $password );

		if ( is_wp_error( $result ) ) {
			wp_send_json_error( array( 'message' => $result->get_error_message() ) );
		}

		// Store API key.
		update_option( 'wooai_api_key', $result['api_key'] );
		update_option( 'wooai_user_email', $result['email'] );
		update_option( 'wooai_balance', $result['balance_tokens'] );

		wp_send_json_success( array(
			'message'  => __( 'Login successful!', 'woo-ai-sales-manager' ),
			'redirect' => admin_url( 'admin.php?page=woo-ai-manager' ),
		) );
	}

	/**
	 * Handle register (legacy)
	 *
	 * @deprecated 1.1.0 Use handle_connect() for domain-based authentication instead.
	 */
	public function handle_register() {
		_doing_it_wrong(
			__METHOD__,
			esc_html__( 'Email/password registration is deprecated. Use domain-based authentication via handle_connect() instead.', 'woo-ai-sales-manager' ),
			'1.1.0'
		);

		$this->verify_request();

		$email    = isset( $_POST['email'] ) ? sanitize_email( $_POST['email'] ) : '';
		$password = isset( $_POST['password'] ) ? $_POST['password'] : '';

		if ( empty( $email ) || empty( $password ) ) {
			wp_send_json_error( array( 'message' => __( 'Email and password are required.', 'woo-ai-sales-manager' ) ) );
		}

		if ( strlen( $password ) < 8 ) {
			wp_send_json_error( array( 'message' => __( 'Password must be at least 8 characters.', 'woo-ai-sales-manager' ) ) );
		}

		$api    = WooAI_API_Client::instance();
		$result = $api->register( $email, $password );

		if ( is_wp_error( $result ) ) {
			wp_send_json_error( array( 'message' => $result->get_error_message() ) );
		}

		// Store API key.
		update_option( 'wooai_api_key', $result['api_key'] );
		update_option( 'wooai_user_email', $result['email'] );
		update_option( 'wooai_balance', $result['balance_tokens'] );

		wp_send_json_success( array(
			'message'  => __( 'Account created successfully!', 'woo-ai-sales-manager' ),
			'redirect' => admin_url( 'admin.php?page=woo-ai-manager' ),
		) );
	}

	/**
	 * Handle connect (domain-based auth)
	 */
	public function handle_connect() {
		$this->verify_request();

		$email  = isset( $_POST['email'] ) ? sanitize_email( $_POST['email'] ) : '';
		$domain = isset( $_POST['domain'] ) ? sanitize_text_field( $_POST['domain'] ) : '';

		if ( empty( $email ) ) {
			wp_send_json_error( array( 'message' => __( 'Email is required.', 'woo-ai-sales-manager' ) ) );
		}

		if ( empty( $domain ) ) {
			wp_send_json_error( array( 'message' => __( 'Domain is required.', 'woo-ai-sales-manager' ) ) );
		}

		$api    = WooAI_API_Client::instance();
		$result = $api->connect( $email, $domain );

		if ( is_wp_error( $result ) ) {
			wp_send_json_error( array( 'message' => $result->get_error_message() ) );
		}

		// Store credentials
		update_option( 'wooai_api_key', $result['api_key'] );
		update_option( 'wooai_user_email', $result['email'] );
		update_option( 'wooai_balance', $result['balance_tokens'] );
		update_option( 'wooai_domain', $result['domain'] );

		$message = isset( $result['is_new'] ) && $result['is_new']
			? __( 'Account created successfully!', 'woo-ai-sales-manager' )
			: __( 'Connected successfully!', 'woo-ai-sales-manager' );

		wp_send_json_success( array(
			'message'  => $message,
			'is_new'   => isset( $result['is_new'] ) ? $result['is_new'] : false,
			'redirect' => admin_url( 'admin.php?page=woo-ai-manager' ),
		) );
	}

	/**
	 * Handle top-up
	 */
	public function handle_topup() {
		$this->verify_request();

		$api    = WooAI_API_Client::instance();
		$result = $api->create_checkout();

		if ( is_wp_error( $result ) ) {
			wp_send_json_error( array( 'message' => $result->get_error_message() ) );
		}

		wp_send_json_success( array(
			'checkout_url' => $result['checkout_url'],
		) );
	}

	/**
	 * Handle generate content
	 */
	public function handle_generate_content() {
		$this->verify_request();

		$product = $this->get_validated_product();
		$action  = isset( $_POST['ai_action'] ) ? sanitize_key( $_POST['ai_action'] ) : 'improve';

		$api    = WooAI_API_Client::instance();
		$result = $api->generate_content( array(
			'product_title'       => $product->get_name(),
			'product_description' => $product->get_description(),
			'action'              => $action,
		) );

		if ( is_wp_error( $result ) ) {
			wp_send_json_error( array( 'message' => $result->get_error_message() ) );
		}

		// Use balance from API response, fallback to stored option for mock mode.
		$balance = isset( $result['new_balance'] ) ? $result['new_balance'] : get_option( 'wooai_balance', 0 );

		wp_send_json_success( array(
			'result'      => $result['result'],
			'tokens_used' => $result['tokens_used'],
			'new_balance' => $balance,
		) );
	}

	/**
	 * Handle suggest taxonomy
	 */
	public function handle_suggest_taxonomy() {
		$this->verify_request();

		$product = $this->get_validated_product();

		$api    = WooAI_API_Client::instance();
		$result = $api->suggest_taxonomy( array(
			'product_title'       => $product->get_name(),
			'product_description' => $product->get_description(),
		) );

		if ( is_wp_error( $result ) ) {
			wp_send_json_error( array( 'message' => $result->get_error_message() ) );
		}

		// Use balance from API response, fallback to stored option for mock mode.
		$balance = isset( $result['new_balance'] ) ? $result['new_balance'] : get_option( 'wooai_balance', 0 );

		wp_send_json_success( array(
			'categories'  => $result['suggested_categories'],
			'tags'        => $result['suggested_tags'],
			'attributes'  => $result['suggested_attributes'],
			'tokens_used' => $result['tokens_used'],
			'new_balance' => $balance,
		) );
	}

	/**
	 * Handle generate image
	 */
	public function handle_generate_image() {
		$this->verify_request();

		$product = $this->get_validated_product();
		$style   = isset( $_POST['style'] ) ? sanitize_key( $_POST['style'] ) : 'product_photo';

		$api    = WooAI_API_Client::instance();
		$result = $api->generate_image( array(
			'product_title'       => $product->get_name(),
			'product_description' => $product->get_description(),
			'style'               => $style,
		) );

		if ( is_wp_error( $result ) ) {
			wp_send_json_error( array( 'message' => $result->get_error_message() ) );
		}

		// Use balance from API response, fallback to stored option for mock mode.
		$balance = isset( $result['new_balance'] ) ? $result['new_balance'] : get_option( 'wooai_balance', 0 );

		wp_send_json_success( array(
			'image_url'   => $result['image_url'],
			'tokens_used' => $result['tokens_used'],
			'new_balance' => $balance,
		) );
	}

	/**
	 * Handle improve image
	 */
	public function handle_improve_image() {
		$this->verify_request();

		// Note: product_id validation is needed here but the product is not used.
		// This ensures the user has access to a valid product context.
		$product_id = isset( $_POST['product_id'] ) ? absint( $_POST['product_id'] ) : 0;
		if ( ! $product_id ) {
			wp_send_json_error( array( 'message' => __( 'Invalid product.', 'woo-ai-sales-manager' ) ) );
		}

		$image_url = isset( $_POST['image_url'] ) ? esc_url_raw( $_POST['image_url'] ) : '';
		$action    = isset( $_POST['improve_action'] ) ? sanitize_key( $_POST['improve_action'] ) : 'enhance';

		if ( empty( $image_url ) ) {
			wp_send_json_error( array( 'message' => __( 'No image selected.', 'woo-ai-sales-manager' ) ) );
		}

		$api    = WooAI_API_Client::instance();
		$result = $api->improve_image( array(
			'image_url' => $image_url,
			'action'    => $action,
		) );

		if ( is_wp_error( $result ) ) {
			wp_send_json_error( array( 'message' => $result->get_error_message() ) );
		}

		// Use balance from API response, fallback to stored option for mock mode.
		$balance = isset( $result['new_balance'] ) ? $result['new_balance'] : get_option( 'wooai_balance', 0 );

		wp_send_json_success( array(
			'image_url'   => $result['image_url'],
			'tokens_used' => $result['tokens_used'],
			'new_balance' => $balance,
		) );
	}

	/**
	 * Handle get balance
	 */
	public function handle_get_balance() {
		$this->verify_request();

		$api     = WooAI_API_Client::instance();
		$account = $api->get_account();

		if ( is_wp_error( $account ) ) {
			wp_send_json_error( array( 'message' => $account->get_error_message() ) );
		}

		wp_send_json_success( array(
			'balance' => $account['balance_tokens'],
		) );
	}

	/**
	 * Handle update product field
	 * Used by chat to apply AI suggestions to products
	 */
	public function handle_update_product_field() {
		$this->verify_chat_request();

		$product_id = isset( $_POST['product_id'] ) ? absint( $_POST['product_id'] ) : 0;
		$field      = isset( $_POST['field'] ) ? sanitize_key( $_POST['field'] ) : '';
		$value      = isset( $_POST['value'] ) ? wp_unslash( $_POST['value'] ) : '';

		if ( ! $product_id ) {
			wp_send_json_error( array( 'message' => __( 'Invalid product.', 'woo-ai-sales-manager' ) ) );
		}

		$product = wc_get_product( $product_id );
		if ( ! $product ) {
			wp_send_json_error( array( 'message' => __( 'Product not found.', 'woo-ai-sales-manager' ) ) );
		}

		// Allowed fields
		$allowed_fields = array(
			'title',
			'description',
			'short_description',
			'tags',
			'categories',
		);

		if ( ! in_array( $field, $allowed_fields, true ) ) {
			wp_send_json_error( array( 'message' => __( 'Invalid field.', 'woo-ai-sales-manager' ) ) );
		}

		// Update the field
		switch ( $field ) {
			case 'title':
				$product->set_name( sanitize_text_field( $value ) );
				break;

			case 'description':
				$product->set_description( wp_kses_post( $value ) );
				break;

			case 'short_description':
				$product->set_short_description( wp_kses_post( $value ) );
				break;

			case 'tags':
				$tags = array_map( 'trim', explode( ',', $value ) );
				$tags = array_filter( $tags );
				wp_set_object_terms( $product_id, $tags, 'product_tag' );
				break;

			case 'categories':
				$categories = array_map( 'trim', explode( ',', $value ) );
				$categories = array_filter( $categories );
				$term_ids   = array();

				foreach ( $categories as $cat_name ) {
					$term = get_term_by( 'name', $cat_name, 'product_cat' );
					if ( $term ) {
						$term_ids[] = $term->term_id;
					} else {
						// Create the category if it doesn't exist
						$new_term = wp_insert_term( $cat_name, 'product_cat' );
						if ( ! is_wp_error( $new_term ) ) {
							$term_ids[] = $new_term['term_id'];
						}
					}
				}

				if ( ! empty( $term_ids ) ) {
					wp_set_object_terms( $product_id, $term_ids, 'product_cat' );
				}
				break;
		}

		// Save the product (for title, description, short_description)
		if ( in_array( $field, array( 'title', 'description', 'short_description' ), true ) ) {
			$product->save();
		}

		wp_send_json_success( array(
			'message' => __( 'Product updated successfully.', 'woo-ai-sales-manager' ),
			'field'   => $field,
		) );
	}

	/**
	 * Handle update category field
	 * Used by chat to apply AI suggestions to categories
	 */
	public function handle_update_category_field() {
		// Use chat nonce
		if ( ! check_ajax_referer( 'wooai_chat_nonce', 'nonce', false ) ) {
			wp_send_json_error( array( 'message' => __( 'Invalid security token.', 'woo-ai-sales-manager' ) ) );
			return;
		}

		if ( ! current_user_can( 'manage_product_terms' ) ) {
			wp_send_json_error( array( 'message' => __( 'Permission denied.', 'woo-ai-sales-manager' ) ) );
			return;
		}

		$category_id = isset( $_POST['category_id'] ) ? absint( $_POST['category_id'] ) : 0;
		$field       = isset( $_POST['field'] ) ? sanitize_key( $_POST['field'] ) : '';
		$value       = isset( $_POST['value'] ) ? wp_unslash( $_POST['value'] ) : '';

		if ( ! $category_id ) {
			wp_send_json_error( array( 'message' => __( 'Invalid category.', 'woo-ai-sales-manager' ) ) );
		}

		$term = get_term( $category_id, 'product_cat' );
		if ( ! $term || is_wp_error( $term ) ) {
			wp_send_json_error( array( 'message' => __( 'Category not found.', 'woo-ai-sales-manager' ) ) );
		}

		// Allowed fields
		$allowed_fields = array(
			'name',
			'description',
			'seo_title',
			'meta_description',
		);

		if ( ! in_array( $field, $allowed_fields, true ) ) {
			wp_send_json_error( array( 'message' => __( 'Invalid field.', 'woo-ai-sales-manager' ) ) );
		}

		// Update the field
		switch ( $field ) {
			case 'name':
				wp_update_term( $category_id, 'product_cat', array(
					'name' => sanitize_text_field( $value ),
				) );
				break;

			case 'description':
				wp_update_term( $category_id, 'product_cat', array(
					'description' => wp_kses_post( $value ),
				) );
				break;

			case 'seo_title':
				// Store as term meta - works with Yoast SEO and RankMath
				update_term_meta( $category_id, '_yoast_wpseo_title', sanitize_text_field( $value ) );
				update_term_meta( $category_id, 'rank_math_title', sanitize_text_field( $value ) );
				update_term_meta( $category_id, 'wooai_seo_title', sanitize_text_field( $value ) );
				break;

			case 'meta_description':
				// Store as term meta - works with Yoast SEO and RankMath
				update_term_meta( $category_id, '_yoast_wpseo_metadesc', sanitize_text_field( $value ) );
				update_term_meta( $category_id, 'rank_math_description', sanitize_text_field( $value ) );
				update_term_meta( $category_id, 'wooai_meta_description', sanitize_text_field( $value ) );
				break;
		}

		wp_send_json_success( array(
			'message' => __( 'Category updated successfully.', 'woo-ai-sales-manager' ),
			'field'   => $field,
		) );
	}

	/**
	 * Handle get category
	 * Used to fetch category data by ID
	 */
	public function handle_get_category() {
		// Use chat nonce
		if ( ! check_ajax_referer( 'wooai_chat_nonce', 'nonce', false ) ) {
			wp_send_json_error( array( 'message' => __( 'Invalid security token.', 'woo-ai-sales-manager' ) ) );
			return;
		}

		$category_id = isset( $_POST['category_id'] ) ? absint( $_POST['category_id'] ) : 0;

		if ( ! $category_id ) {
			wp_send_json_error( array( 'message' => __( 'Invalid category.', 'woo-ai-sales-manager' ) ) );
		}

		$term = get_term( $category_id, 'product_cat' );
		if ( ! $term || is_wp_error( $term ) ) {
			wp_send_json_error( array( 'message' => __( 'Category not found.', 'woo-ai-sales-manager' ) ) );
		}

		// Get parent info
		$parent_name = '';
		if ( $term->parent ) {
			$parent_term = get_term( $term->parent, 'product_cat' );
			if ( $parent_term && ! is_wp_error( $parent_term ) ) {
				$parent_name = $parent_term->name;
			}
		}

		// Get subcategories
		$subcategories = get_terms( array(
			'taxonomy'   => 'product_cat',
			'parent'     => $category_id,
			'hide_empty' => false,
		) );

		$subcats = array();
		if ( ! is_wp_error( $subcategories ) ) {
			foreach ( $subcategories as $subcat ) {
				$subcats[] = array(
					'id'   => $subcat->term_id,
					'name' => $subcat->name,
				);
			}
		}

		// Get SEO meta
		$seo_title = get_term_meta( $category_id, 'wooai_seo_title', true );
		if ( empty( $seo_title ) ) {
			$seo_title = get_term_meta( $category_id, '_yoast_wpseo_title', true );
		}
		if ( empty( $seo_title ) ) {
			$seo_title = get_term_meta( $category_id, 'rank_math_title', true );
		}

		$meta_description = get_term_meta( $category_id, 'wooai_meta_description', true );
		if ( empty( $meta_description ) ) {
			$meta_description = get_term_meta( $category_id, '_yoast_wpseo_metadesc', true );
		}
		if ( empty( $meta_description ) ) {
			$meta_description = get_term_meta( $category_id, 'rank_math_description', true );
		}

		wp_send_json_success( array(
			'id'                => $term->term_id,
			'name'              => $term->name,
			'slug'              => $term->slug,
			'description'       => $term->description,
			'parent_id'         => $term->parent,
			'parent_name'       => $parent_name,
			'product_count'     => $term->count,
			'subcategory_count' => count( $subcats ),
			'subcategories'     => $subcats,
			'seo_title'         => $seo_title,
			'meta_description'  => $meta_description,
			'edit_url'          => admin_url( 'term.php?taxonomy=product_cat&tag_ID=' . $category_id ),
			'view_url'          => get_term_link( $term ),
		) );
	}

	/**
	 * Handle save store context
	 */
	public function handle_save_store_context() {
		$this->verify_chat_admin_request();

		$context = isset( $_POST['context'] ) ? $_POST['context'] : array();

		$store_context = array(
			'store_name'          => isset( $context['store_name'] ) ? sanitize_text_field( $context['store_name'] ) : '',
			'store_description'   => isset( $context['store_description'] ) ? sanitize_textarea_field( $context['store_description'] ) : '',
			'business_niche'      => isset( $context['business_niche'] ) ? sanitize_key( $context['business_niche'] ) : '',
			'target_audience'     => isset( $context['target_audience'] ) ? sanitize_text_field( $context['target_audience'] ) : '',
			'brand_tone'          => isset( $context['brand_tone'] ) ? sanitize_key( $context['brand_tone'] ) : '',
			'language'            => isset( $context['language'] ) ? sanitize_text_field( $context['language'] ) : 'English',
			'custom_instructions' => isset( $context['custom_instructions'] ) ? sanitize_textarea_field( $context['custom_instructions'] ) : '',
			'updated_at'          => current_time( 'mysql' ),
		);

		// Preserve sync data if it exists
		$existing = get_option( 'wooai_store_context', array() );
		if ( isset( $existing['last_sync'] ) ) {
			$store_context['last_sync']       = $existing['last_sync'];
			$store_context['category_count']  = $existing['category_count'];
			$store_context['product_count']   = $existing['product_count'];
		}

		update_option( 'wooai_store_context', $store_context );

		wp_send_json_success( array(
			'message' => __( 'Store context saved successfully.', 'woo-ai-sales-manager' ),
		) );
	}

	/**
	 * Handle sync store context
	 */
	public function handle_sync_store_context() {
		$this->verify_chat_admin_request();

		// Count products and categories
		$product_count = wp_count_posts( 'product' );
		$product_total = isset( $product_count->publish ) ? $product_count->publish : 0;

		$category_count = wp_count_terms( array(
			'taxonomy'   => 'product_cat',
			'hide_empty' => false,
		) );

		if ( is_wp_error( $category_count ) ) {
			$category_count = 0;
		}

		// Update store context
		$store_context = get_option( 'wooai_store_context', array() );
		$store_context['last_sync']      = current_time( 'mysql' );
		$store_context['category_count'] = $category_count;
		$store_context['product_count']  = $product_total;

		update_option( 'wooai_store_context', $store_context );

		wp_send_json_success( array(
			'message' => sprintf(
				/* translators: %1$s: category count, %2$s: product count */
				__( 'Synced: %1$s categories, %2$s products', 'woo-ai-sales-manager' ),
				number_format_i18n( $category_count ),
				number_format_i18n( $product_total )
			),
		) );
	}

	/**
	 * Handle mark chat visited
	 */
	public function handle_mark_chat_visited() {
		// Use chat nonce
		if ( ! check_ajax_referer( 'wooai_chat_nonce', 'nonce', false ) ) {
			wp_send_json_error( array( 'message' => __( 'Invalid security token.', 'woo-ai-sales-manager' ) ) );
			return;
		}

		update_user_meta( get_current_user_id(), 'wooai_chat_visited', true );

		wp_send_json_success();
	}

	/**
	 * Handle sync balance from chat page
	 */
	public function handle_sync_balance() {
		$this->verify_chat_admin_request();

		$balance = isset( $_POST['balance'] ) ? absint( $_POST['balance'] ) : null;

		if ( null === $balance ) {
			wp_send_json_error( array( 'message' => __( 'Invalid balance value.', 'woo-ai-sales-manager' ) ) );
			return;
		}

		update_option( 'wooai_balance', $balance );

		wp_send_json_success( array( 'balance' => $balance ) );
	}

	/**
	 * Handle save generated image to media library
	 * Used by agent mode to save AI-generated marketing images
	 */
	public function handle_save_generated_image() {
		// Use chat nonce
		if ( ! check_ajax_referer( 'wooai_chat_nonce', 'nonce', false ) ) {
			wp_send_json_error( array( 'message' => __( 'Invalid security token.', 'woo-ai-sales-manager' ) ) );
			return;
		}

		if ( ! current_user_can( 'upload_files' ) ) {
			wp_send_json_error( array( 'message' => __( 'Permission denied.', 'woo-ai-sales-manager' ) ) );
			return;
		}

		$image_data = isset( $_POST['image_data'] ) ? $_POST['image_data'] : '';
		$filename   = isset( $_POST['filename'] ) ? sanitize_file_name( $_POST['filename'] ) : 'ai-generated-image.png';
		$title      = isset( $_POST['title'] ) ? sanitize_text_field( $_POST['title'] ) : '';

		if ( empty( $image_data ) ) {
			wp_send_json_error( array( 'message' => __( 'No image data provided.', 'woo-ai-sales-manager' ) ) );
			return;
		}

		// Handle base64 encoded data
		if ( strpos( $image_data, 'data:image/' ) === 0 ) {
			// Extract mime type and base64 data
			preg_match( '/data:image\/(\w+);base64,(.+)/', $image_data, $matches );
			if ( count( $matches ) !== 3 ) {
				wp_send_json_error( array( 'message' => __( 'Invalid image data format.', 'woo-ai-sales-manager' ) ) );
				return;
			}
			$extension   = $matches[1];
			$image_data  = $matches[2];
			
			// Update filename extension if needed
			$filename = preg_replace( '/\.[^.]+$/', '.' . $extension, $filename );
		}

		// Decode base64
		$decoded = base64_decode( $image_data );
		if ( false === $decoded ) {
			wp_send_json_error( array( 'message' => __( 'Failed to decode image data.', 'woo-ai-sales-manager' ) ) );
			return;
		}

		// Verify it's a valid image
		$finfo = new finfo( FILEINFO_MIME_TYPE );
		$mime  = $finfo->buffer( $decoded );

		$allowed_mimes = array( 'image/jpeg', 'image/png', 'image/gif', 'image/webp' );
		if ( ! in_array( $mime, $allowed_mimes, true ) ) {
			wp_send_json_error( array( 'message' => __( 'Invalid image type.', 'woo-ai-sales-manager' ) ) );
			return;
		}

		// Get WordPress upload directory
		$upload_dir = wp_upload_dir();
		if ( ! empty( $upload_dir['error'] ) ) {
			wp_send_json_error( array( 'message' => $upload_dir['error'] ) );
			return;
		}

		// Generate unique filename
		$unique_filename = wp_unique_filename( $upload_dir['path'], $filename );
		$upload_path     = $upload_dir['path'] . '/' . $unique_filename;

		// Save the file
		$saved = file_put_contents( $upload_path, $decoded );
		if ( false === $saved ) {
			wp_send_json_error( array( 'message' => __( 'Failed to save image file.', 'woo-ai-sales-manager' ) ) );
			return;
		}

		// Prepare attachment data
		$attachment = array(
			'post_mime_type' => $mime,
			'post_title'     => ! empty( $title ) ? $title : pathinfo( $unique_filename, PATHINFO_FILENAME ),
			'post_content'   => '',
			'post_status'    => 'inherit',
		);

		// Insert attachment
		$attachment_id = wp_insert_attachment( $attachment, $upload_path );
		if ( is_wp_error( $attachment_id ) ) {
			wp_delete_file( $upload_path );
			wp_send_json_error( array( 'message' => $attachment_id->get_error_message() ) );
			return;
		}

		// Generate attachment metadata
		require_once ABSPATH . 'wp-admin/includes/image.php';
		$metadata = wp_generate_attachment_metadata( $attachment_id, $upload_path );
		wp_update_attachment_metadata( $attachment_id, $metadata );

		wp_send_json_success( array(
			'message'       => __( 'Image saved to media library.', 'woo-ai-sales-manager' ),
			'attachment_id' => $attachment_id,
			'url'           => wp_get_attachment_url( $attachment_id ),
			'edit_url'      => admin_url( 'upload.php?item=' . $attachment_id ),
		) );
	}

	/**
	 * Handle get store summary
	 * Used by agent mode to get store statistics for context
	 */
	public function handle_get_store_summary() {
		$this->verify_chat_admin_request();

		// Get product counts
		$product_counts = wp_count_posts( 'product' );
		$total_products = isset( $product_counts->publish ) ? (int) $product_counts->publish : 0;
		$draft_products = isset( $product_counts->draft ) ? (int) $product_counts->draft : 0;

		// Get category count
		$category_count = wp_count_terms( array(
			'taxonomy'   => 'product_cat',
			'hide_empty' => false,
		) );
		if ( is_wp_error( $category_count ) ) {
			$category_count = 0;
		}

		// Get tag count
		$tag_count = wp_count_terms( array(
			'taxonomy'   => 'product_tag',
			'hide_empty' => false,
		) );
		if ( is_wp_error( $tag_count ) ) {
			$tag_count = 0;
		}

		// Get order statistics (last 30 days)
		$thirty_days_ago = gmdate( 'Y-m-d', strtotime( '-30 days' ) );
		$order_counts    = array(
			'total'      => 0,
			'processing' => 0,
			'completed'  => 0,
		);

		if ( function_exists( 'wc_get_orders' ) ) {
			$recent_orders = wc_get_orders( array(
				'date_created' => '>' . $thirty_days_ago,
				'limit'        => -1,
				'return'       => 'ids',
			) );
			$order_counts['total'] = count( $recent_orders );

			$processing_orders = wc_get_orders( array(
				'status'       => 'processing',
				'date_created' => '>' . $thirty_days_ago,
				'limit'        => -1,
				'return'       => 'ids',
			) );
			$order_counts['processing'] = count( $processing_orders );

			$completed_orders = wc_get_orders( array(
				'status'       => 'completed',
				'date_created' => '>' . $thirty_days_ago,
				'limit'        => -1,
				'return'       => 'ids',
			) );
			$order_counts['completed'] = count( $completed_orders );
		}

		// Get top categories by product count
		$top_categories = get_terms( array(
			'taxonomy'   => 'product_cat',
			'orderby'    => 'count',
			'order'      => 'DESC',
			'number'     => 5,
			'hide_empty' => false,
		) );

		$categories = array();
		if ( ! is_wp_error( $top_categories ) ) {
			foreach ( $top_categories as $cat ) {
				$categories[] = array(
					'id'            => $cat->term_id,
					'name'          => $cat->name,
					'product_count' => $cat->count,
				);
			}
		}

		// Get products with missing descriptions
		$products_missing_desc = new WP_Query( array(
			'post_type'      => 'product',
			'post_status'    => 'publish',
			'posts_per_page' => -1,
			'fields'         => 'ids',
			'meta_query'     => array(
				'relation' => 'OR',
				array(
					'key'     => '_product_description',
					'compare' => 'NOT EXISTS',
				),
			),
		) );

		// Count products with empty description via direct query for accuracy
		global $wpdb;
		$empty_desc_count = (int) $wpdb->get_var(
			"SELECT COUNT(*) FROM {$wpdb->posts} 
			WHERE post_type = 'product' 
			AND post_status = 'publish' 
			AND (post_content = '' OR post_content IS NULL)"
		);

		// Get products without images
		$products_no_image = (int) $wpdb->get_var(
			"SELECT COUNT(*) FROM {$wpdb->posts} p
			LEFT JOIN {$wpdb->postmeta} pm ON p.ID = pm.post_id AND pm.meta_key = '_thumbnail_id'
			WHERE p.post_type = 'product' 
			AND p.post_status = 'publish'
			AND (pm.meta_value IS NULL OR pm.meta_value = '')"
		);

		// Get store context for additional info
		$store_context = get_option( 'wooai_store_context', array() );

		wp_send_json_success( array(
			'products'        => array(
				'total'         => $total_products,
				'draft'         => $draft_products,
				'missing_desc'  => $empty_desc_count,
				'missing_image' => $products_no_image,
			),
			'categories'      => array(
				'total' => (int) $category_count,
				'top'   => $categories,
			),
			'tags'            => array(
				'total' => (int) $tag_count,
			),
			'orders'          => $order_counts,
			'store_context'   => array(
				'name'        => isset( $store_context['store_name'] ) ? $store_context['store_name'] : get_bloginfo( 'name' ),
				'description' => isset( $store_context['store_description'] ) ? $store_context['store_description'] : '',
				'niche'       => isset( $store_context['business_niche'] ) ? $store_context['business_niche'] : '',
				'audience'    => isset( $store_context['target_audience'] ) ? $store_context['target_audience'] : '',
				'tone'        => isset( $store_context['brand_tone'] ) ? $store_context['brand_tone'] : '',
			),
			'currency'        => get_woocommerce_currency(),
			'currency_symbol' => get_woocommerce_currency_symbol(),
		) );
	}

	/**
	 * Handle fetch tool data
	 * Used by AI Agent mode to execute tool calls and fetch store data
	 *
	 * Expected POST data:
	 * - requests: array of tool requests, each containing:
	 *   - request_id: string
	 *   - tool: string (get_products|get_categories|get_products_by_category|get_page_content)
	 *   - params: object
	 */
	public function handle_fetch_tool_data() {
		$this->verify_chat_admin_request();

		$requests = isset( $_POST['requests'] ) ? $_POST['requests'] : array();

		if ( empty( $requests ) || ! is_array( $requests ) ) {
			wp_send_json_error( array( 'message' => __( 'No tool requests provided.', 'woo-ai-sales-manager' ) ) );
			return;
		}

		// Load tool executor
		require_once WOOAI_PLUGIN_DIR . 'includes/class-wooai-tool-executor.php';
		$executor = new WooAI_Tool_Executor();

		$results = array();

		foreach ( $requests as $request ) {
			$request_id = isset( $request['request_id'] ) ? sanitize_text_field( $request['request_id'] ) : '';
			$tool       = isset( $request['tool'] ) ? sanitize_key( $request['tool'] ) : '';
			$params     = isset( $request['params'] ) ? $request['params'] : array();

			if ( empty( $request_id ) || empty( $tool ) ) {
				$results[] = array(
					'request_id' => $request_id,
					'tool'       => $tool,
					'success'    => false,
					'error'      => __( 'Invalid request format.', 'woo-ai-sales-manager' ),
				);
				continue;
			}

			// Execute the tool
			$result = $executor->execute( $tool, $params );

			$results[] = array(
				'request_id' => $request_id,
				'tool'       => $tool,
				'success'    => ! is_wp_error( $result ),
				'data'       => is_wp_error( $result ) ? null : $result,
				'error'      => is_wp_error( $result ) ? $result->get_error_message() : null,
			);
		}

		wp_send_json_success( array(
			'tool_results' => $results,
		) );
	}
}
