# AI Sales Manager for WooCommerce - Developer Notes

## Project Structure

```
plugin/
├── ai-sales-manager-for-woocommerce.php  # Main plugin file
├── includes/                              # PHP classes
│   ├── ajax/                              # AJAX handlers (modular)
│   │   ├── class-aisales-ajax-base.php    # Abstract base class
│   │   ├── class-aisales-ajax-loader.php  # Loader/initializer
│   │   ├── class-aisales-ajax-auth.php    # Auth & account handlers
│   │   ├── class-aisales-ajax-billing.php # Billing & payment handlers
│   │   ├── class-aisales-ajax-ai.php      # AI generation handlers
│   │   ├── class-aisales-ajax-products.php# Product & category handlers
│   │   ├── class-aisales-ajax-email.php   # Email template handlers
│   │   ├── class-aisales-ajax-support.php # Support ticket handlers
│   │   ├── class-aisales-ajax-brand.php   # Brand settings handlers
│   │   └── class-aisales-ajax-store.php   # Store context handlers
│   ├── widgets/                           # Widgets subsystem
│   │   └── class-aisales-widgets-page.php
│   ├── class-aisales-admin-settings.php
│   ├── class-aisales-email-page.php
│   ├── class-aisales-brand-page.php
│   └── ...
├── templates/                             # PHP templates
│   ├── admin-widgets-page.php
│   ├── admin-email-page.php
│   ├── admin-brand-page.php
│   └── ...
├── assets/
│   ├── css/                               # Stylesheets
│   │   ├── admin.css                      # Main admin styles
│   │   ├── shared-components.css          # Reusable components
│   │   ├── widgets-page.css
│   │   ├── email-page.css
│   │   └── chat/                          # Modular chat styles
│   └── js/                                # JavaScript
│       ├── admin.js                       # Main admin JS
│       ├── widgets-page.js
│       ├── email-page.js
│       └── chat/                          # Modular chat JS
```

## Git Repository

Git is initialized in the `plugin/` subfolder, not the project root.

```bash
cd plugin && git status
```

## Widgets System Architecture

### Widget Types

Widgets are divided into two types:

1. **Shortcodes** (`'type' => 'shortcode'`)
   - Pure shortcodes that users place manually in content/templates
   - No toggle switch - if you don't use the shortcode, it does nothing
   - Examples: `[aisales_total_sold]`, `[aisales_countdown]`, `[aisales_bestsellers]`

2. **Features** (`'type' => 'feature'`)
   - Auto-inject functionality that runs automatically when enabled
   - Has enable/disable toggle in the admin UI
   - Examples:
     - `recent_purchase` - Auto-display popup notifications site-wide
     - `live_viewers` - Auto-display visitor count on product pages
     - `shipping_bar` - Auto-display on cart page

### Widget Definitions

Located in `includes/widgets/class-aisales-widgets-page.php`:

```php
'widget_key' => array(
    'name'        => __( 'Widget Name', 'ai-sales-manager-for-woocommerce' ),
    'description' => __( 'Description', 'ai-sales-manager-for-woocommerce' ),
    'shortcode'   => 'aisales_shortcode_name',
    'category'    => 'social_proof', // social_proof, conversion, discovery
    'type'        => 'shortcode',    // shortcode or feature
    'icon'        => 'dashicons-icon-name',
    'attributes'  => array( ... ),
    'preview'     => array( ... ),
),
```

### Categories

- `social_proof` - Build trust (Sales Counter, Recent Purchase, Live Viewers, etc.)
- `conversion` - Optimize sales (Shipping Bar, Countdown Timer, Price Drop, etc.)
- `discovery` - Product discovery (Best Sellers, Trending, Recently Viewed, etc.)

## CSS Architecture

### Design System Variables

Defined in `assets/css/admin.css`:

```css
--aisales-primary: #2271b1;
--aisales-success: #00a32a;
--aisales-warning: #dba617;
--aisales-danger: #d63638;
--aisales-text-primary: #1d2327;
--aisales-border-light: #dcdcde;
/* ... etc */
```

### Shared Components (`shared-components.css`)

Reusable UI components:
- `.aisales-balance-indicator` - Token balance pill (used in headers)
- `.aisales-store-context-btn` - Store context button
- `.aisales-header-btn` - Generic header button style

### Page-Specific Styles

Each admin page has its own CSS file:
- `widgets-page.css` - Widgets & Shortcodes page
- `email-page.css` - Email Templates page
- `brand-page.css` - Brand Settings page

### Badge Patterns

For custom badges that look like `.aisales-balance-indicator` but don't share its JS behavior, create standalone classes:

```css
/* Example: widgets-page.css */
.aisales-widgets-active-badge {
  display: inline-flex;
  align-items: center;
  gap: var(--aisales-space-2, 6px);
  padding: var(--aisales-space-2, 6px) var(--aisales-space-4, 12px);
  background: var(--aisales-bg-white, #fff);
  border: 1px solid var(--aisales-success, #00a32a);
  border-radius: var(--aisales-radius-full, 9999px);
  /* ... */
}
```

## AJAX Architecture

AJAX handlers are organized into domain-specific classes in `includes/ajax/`:

### Handler Classes

| Class | Domain | Handlers |
|-------|--------|----------|
| `AISales_Ajax_Auth` | Authentication | connect, get_balance, recovery |
| `AISales_Ajax_Billing` | Payments | topup, auto_topup, payment_method |
| `AISales_Ajax_AI` | AI Generation | generate_content, suggest_taxonomy, images |
| `AISales_Ajax_Products` | Products/Categories | update fields, thumbnails, batch |
| `AISales_Ajax_Email` | Email Templates | templates, wizard, test emails |
| `AISales_Ajax_Support` | Support Tickets | draft, submit, list, upload |
| `AISales_Ajax_Brand` | Brand Settings | save settings, AI analysis |
| `AISales_Ajax_Store` | Store Context | sync, balance, tool data |

### Creating New AJAX Handlers

1. Extend `AISales_Ajax_Base`
2. Implement `register_actions()` method
3. Use helper methods from base class

```php
class AISales_Ajax_Example extends AISales_Ajax_Base {
    protected function register_actions() {
        $this->add_action( 'my_action', 'handle_my_action' );
    }

    public function handle_my_action() {
        $this->verify_request();
        $value = $this->get_post( 'field_name', 'text' );
        // ... handle request
        $this->success( array( 'result' => $value ) );
    }
}
```

### Base Class Helpers

- `verify_request()` - Check nonce and capability
- `get_post( $key, $type, $default )` - Get sanitized POST value
- `require_post( $key, $type, $error )` - Get required POST value
- `success( $data )` - Send JSON success response
- `error( $message, $data )` - Send JSON error response
- `handle_api_result( $result )` - Handle API response with error checking
- `get_validated_product( $id )` - Get and validate WC_Product
- `get_validated_category( $id )` - Get and validate product category

## JavaScript Patterns

### AJAX Calls

All AJAX actions use the `aisales_` prefix:

### Localized Script Data

```php
wp_localize_script( 'aisales-widgets-page', 'aisalesWidgets', array(
    'ajaxUrl' => admin_url( 'admin-ajax.php' ),
    'nonce'   => wp_create_nonce( 'aisales_nonce' ),
    // ... other data
) );
```

## Admin Pages

### Page Hook Names

Used for conditional asset loading:
- `toplevel_page_ai-sales-manager` - Main settings
- `ai-sales-manager_page_ai-sales-agent` - AI Agent/Chat
- `ai-sales-manager_page_ai-sales-emails` - Email Templates
- `ai-sales-manager_page_ai-sales-brand` - Brand Settings
- `ai-sales-manager_page_ai-sales-widgets` - Widgets & Shortcodes

### Header Pattern

All admin pages follow consistent header structure:
```php
<header class="aisales-{page}-header">
    <div class="aisales-{page}-header__left">
        <span class="aisales-{page}-header__title">
            <span class="dashicons dashicons-{icon}"></span>
            <?php esc_html_e( 'Page Title', 'ai-sales-manager-for-woocommerce' ); ?>
        </span>
        <span class="aisales-{page}-header__subtitle">...</span>
    </div>
    <div class="aisales-{page}-header__right">
        <!-- Badge or action buttons -->
    </div>
</header>
```
