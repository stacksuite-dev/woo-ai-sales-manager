<?php
/**
 * Store Context Panel Partial
 *
 * Shared slide-out panel for configuring store context used by AI.
 * Used on both the AI Agent page and the main WooAI Sales Manager page.
 *
 * Expected variable:
 * - $store_context (array) - Current store context from get_option( 'wooai_store_context' )
 *
 * @package WooAI_Sales_Manager
 */

defined( 'ABSPATH' ) || exit;

// Ensure store_context is set
if ( ! isset( $store_context ) ) {
	$store_context = get_option( 'wooai_store_context', array() );
}
?>
<!-- Store Context Slide-out Panel -->
<div class="wooai-context-panel" id="wooai-context-panel">
	<div class="wooai-context-panel__backdrop" id="wooai-context-backdrop"></div>
	<div class="wooai-context-panel__content">
		<div class="wooai-context-panel__header">
			<h2>
				<span class="dashicons dashicons-store"></span>
				<?php esc_html_e( 'Store Context', 'woo-ai-sales-manager' ); ?>
			</h2>
			<button type="button" class="wooai-context-panel__close" id="wooai-close-context">
				<span class="dashicons dashicons-no-alt"></span>
			</button>
		</div>
		<div class="wooai-context-panel__body">
			<p class="wooai-context-panel__intro">
				<?php esc_html_e( 'Your store information helps AI write better content that matches your brand.', 'woo-ai-sales-manager' ); ?>
			</p>

			<form id="wooai-context-form" class="wooai-context-form">
				<!-- Store Name -->
				<div class="wooai-context-field">
					<label for="wooai-store-name"><?php esc_html_e( 'Store Name', 'woo-ai-sales-manager' ); ?></label>
					<input type="text" id="wooai-store-name" name="store_name" 
						value="<?php echo esc_attr( isset( $store_context['store_name'] ) ? $store_context['store_name'] : get_bloginfo( 'name' ) ); ?>"
						placeholder="<?php esc_attr_e( 'My Awesome Store', 'woo-ai-sales-manager' ); ?>">
				</div>

				<!-- Store Description -->
				<div class="wooai-context-field">
					<label for="wooai-store-description"><?php esc_html_e( 'Store Description', 'woo-ai-sales-manager' ); ?></label>
					<textarea id="wooai-store-description" name="store_description" rows="2"
						placeholder="<?php esc_attr_e( 'Brief description of what you sell...', 'woo-ai-sales-manager' ); ?>"><?php echo esc_textarea( isset( $store_context['store_description'] ) ? $store_context['store_description'] : get_bloginfo( 'description' ) ); ?></textarea>
				</div>

				<!-- Business Niche -->
				<div class="wooai-context-field">
					<label for="wooai-business-niche"><?php esc_html_e( 'Business Niche', 'woo-ai-sales-manager' ); ?></label>
					<select id="wooai-business-niche" name="business_niche">
						<option value=""><?php esc_html_e( 'Select a niche...', 'woo-ai-sales-manager' ); ?></option>
						<?php
						$niches = array(
							'fashion'       => __( 'Fashion & Apparel', 'woo-ai-sales-manager' ),
							'electronics'   => __( 'Electronics & Tech', 'woo-ai-sales-manager' ),
							'home_garden'   => __( 'Home & Garden', 'woo-ai-sales-manager' ),
							'health_beauty' => __( 'Health & Beauty', 'woo-ai-sales-manager' ),
							'sports'        => __( 'Sports & Outdoors', 'woo-ai-sales-manager' ),
							'toys_games'    => __( 'Toys & Games', 'woo-ai-sales-manager' ),
							'food_beverage' => __( 'Food & Beverage', 'woo-ai-sales-manager' ),
							'jewelry'       => __( 'Jewelry & Accessories', 'woo-ai-sales-manager' ),
							'automotive'    => __( 'Automotive', 'woo-ai-sales-manager' ),
							'books_media'   => __( 'Books & Media', 'woo-ai-sales-manager' ),
							'pets'          => __( 'Pet Supplies', 'woo-ai-sales-manager' ),
							'art_crafts'    => __( 'Art & Crafts', 'woo-ai-sales-manager' ),
							'office'        => __( 'Office & Business', 'woo-ai-sales-manager' ),
							'baby_kids'     => __( 'Baby & Kids', 'woo-ai-sales-manager' ),
							'other'         => __( 'Other', 'woo-ai-sales-manager' ),
						);
						$current_niche = isset( $store_context['business_niche'] ) ? $store_context['business_niche'] : '';
						foreach ( $niches as $value => $label ) :
						?>
							<option value="<?php echo esc_attr( $value ); ?>" <?php selected( $current_niche, $value ); ?>><?php echo esc_html( $label ); ?></option>
						<?php endforeach; ?>
					</select>
				</div>

				<!-- Target Audience -->
				<div class="wooai-context-field">
					<label for="wooai-target-audience"><?php esc_html_e( 'Target Audience', 'woo-ai-sales-manager' ); ?></label>
					<input type="text" id="wooai-target-audience" name="target_audience"
						value="<?php echo esc_attr( isset( $store_context['target_audience'] ) ? $store_context['target_audience'] : '' ); ?>"
						placeholder="<?php esc_attr_e( 'e.g., Young professionals 25-40', 'woo-ai-sales-manager' ); ?>">
				</div>

				<!-- Brand Tone -->
				<div class="wooai-context-field">
					<label><?php esc_html_e( 'Brand Tone', 'woo-ai-sales-manager' ); ?></label>
					<div class="wooai-tone-options">
						<?php
						$tones = array(
							'professional' => array( 'icon' => 'businessman', 'label' => __( 'Professional', 'woo-ai-sales-manager' ) ),
							'friendly'     => array( 'icon' => 'smiley', 'label' => __( 'Friendly', 'woo-ai-sales-manager' ) ),
							'luxury'       => array( 'icon' => 'star-filled', 'label' => __( 'Luxury', 'woo-ai-sales-manager' ) ),
							'casual'       => array( 'icon' => 'format-status', 'label' => __( 'Casual', 'woo-ai-sales-manager' ) ),
							'technical'    => array( 'icon' => 'desktop', 'label' => __( 'Technical', 'woo-ai-sales-manager' ) ),
							'playful'      => array( 'icon' => 'heart', 'label' => __( 'Playful', 'woo-ai-sales-manager' ) ),
						);
						$current_tone = isset( $store_context['brand_tone'] ) ? $store_context['brand_tone'] : '';
						foreach ( $tones as $value => $tone ) :
						?>
							<label class="wooai-tone-option">
								<input type="radio" name="brand_tone" value="<?php echo esc_attr( $value ); ?>" <?php checked( $current_tone, $value ); ?>>
								<span class="wooai-tone-option__content">
									<span class="dashicons dashicons-<?php echo esc_attr( $tone['icon'] ); ?>"></span>
									<span><?php echo esc_html( $tone['label'] ); ?></span>
								</span>
							</label>
						<?php endforeach; ?>
					</div>
				</div>

				<!-- Language -->
				<div class="wooai-context-field">
					<label for="wooai-language"><?php esc_html_e( 'Content Language', 'woo-ai-sales-manager' ); ?></label>
					<select id="wooai-language" name="language">
						<?php
						$languages = array(
							'English'    => __( 'English', 'woo-ai-sales-manager' ),
							'Spanish'    => __( 'Spanish', 'woo-ai-sales-manager' ),
							'French'     => __( 'French', 'woo-ai-sales-manager' ),
							'German'     => __( 'German', 'woo-ai-sales-manager' ),
							'Italian'    => __( 'Italian', 'woo-ai-sales-manager' ),
							'Portuguese' => __( 'Portuguese', 'woo-ai-sales-manager' ),
							'Dutch'      => __( 'Dutch', 'woo-ai-sales-manager' ),
							'Japanese'   => __( 'Japanese', 'woo-ai-sales-manager' ),
							'Chinese'    => __( 'Chinese', 'woo-ai-sales-manager' ),
							'Korean'     => __( 'Korean', 'woo-ai-sales-manager' ),
							'Thai'       => __( 'Thai', 'woo-ai-sales-manager' ),
						);
						$current_lang = isset( $store_context['language'] ) ? $store_context['language'] : 'English';
						foreach ( $languages as $value => $label ) :
						?>
							<option value="<?php echo esc_attr( $value ); ?>" <?php selected( $current_lang, $value ); ?>><?php echo esc_html( $label ); ?></option>
						<?php endforeach; ?>
					</select>
				</div>

				<!-- Custom Instructions -->
				<div class="wooai-context-field">
					<label for="wooai-custom-instructions"><?php esc_html_e( 'Custom Instructions', 'woo-ai-sales-manager' ); ?> <span class="wooai-optional"><?php esc_html_e( '(optional)', 'woo-ai-sales-manager' ); ?></span></label>
					<textarea id="wooai-custom-instructions" name="custom_instructions" rows="3"
						placeholder="<?php esc_attr_e( 'e.g., Always mention free shipping, use metric units, avoid certain words...', 'woo-ai-sales-manager' ); ?>"><?php echo esc_textarea( isset( $store_context['custom_instructions'] ) ? $store_context['custom_instructions'] : '' ); ?></textarea>
				</div>

				<!-- Sync Status -->
				<div class="wooai-context-sync">
					<div class="wooai-context-sync__info">
						<span class="dashicons dashicons-update"></span>
						<span id="wooai-sync-status">
							<?php
							$last_sync = isset( $store_context['last_sync'] ) ? $store_context['last_sync'] : '';
							if ( $last_sync ) {
								printf(
									/* translators: %1$s: number of categories, %2$s: number of products, %3$s: date */
									esc_html__( 'Synced: %1$s categories, %2$s products on %3$s', 'woo-ai-sales-manager' ),
									isset( $store_context['category_count'] ) ? esc_html( $store_context['category_count'] ) : '0',
									isset( $store_context['product_count'] ) ? esc_html( $store_context['product_count'] ) : '0',
									esc_html( date_i18n( get_option( 'date_format' ), strtotime( $last_sync ) ) )
								);
							} else {
								esc_html_e( 'Not synced yet', 'woo-ai-sales-manager' );
							}
							?>
						</span>
					</div>
					<button type="button" class="wooai-btn wooai-btn--outline wooai-btn--sm" id="wooai-sync-context">
						<span class="dashicons dashicons-update"></span>
						<?php esc_html_e( 'Sync Now', 'woo-ai-sales-manager' ); ?>
					</button>
				</div>
			</form>
		</div>
		<div class="wooai-context-panel__footer">
			<button type="button" class="wooai-btn wooai-btn--outline" id="wooai-cancel-context">
				<?php esc_html_e( 'Cancel', 'woo-ai-sales-manager' ); ?>
			</button>
			<button type="button" class="wooai-btn wooai-btn--primary" id="wooai-save-context">
				<span class="dashicons dashicons-saved"></span>
				<?php esc_html_e( 'Save Context', 'woo-ai-sales-manager' ); ?>
			</button>
		</div>
	</div>
</div>
