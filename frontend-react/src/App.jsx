import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import { customerSupabase as supabase } from './lib/supabase';
import { defaultProducts, loadProducts, saveProducts } from './utils/catalogStorage';
import './App.css';

const AdminPortal = lazy(() => import('./AdminPortal'));

const CART_KEY = 'mavoryi-cart';
const VISITOR_ID_STORAGE_KEY = 'mavoryi-daily-visitor';
const UPCOMING_RETURN_KEY = 'mavoryi-upcoming-after-auth';
const WHATSAPP_NUMBER = '233549181995';
const ADMIN_EMAIL = 'casadimavoryi@gmail.com';

const toCustomerUser = (user) => {
  if (!user) return null;
  return {
    id: user.id,
    name: user.user_metadata?.name || user.email?.split('@')[0] || 'MAVORYI member',
    email: user.email || '',
    created_at: user.created_at,
  };
};

const formatPrice = (price) => {
  if (price === null || price === undefined || price === '') return 'Price on request';
  const amount = Number(price);
  return Number.isFinite(amount)
    ? `GHS ${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    : 'Price on request';
};

const normalizeImage = (value) => {
  if (!value) return '';
  if (/^https?:\/\//i.test(value) || value.startsWith('/')) return value;
  return new URL(`${import.meta.env.BASE_URL}images/${encodeURI(value.trim())}`, document.baseURI).toString();
};

const readCart = () => {
  try {
    const stored = JSON.parse(localStorage.getItem(CART_KEY) || '[]');
    return Array.isArray(stored)
      ? stored
          .filter((item) => item?.id && Number(item.quantity) > 0)
          .map((item) => item.id === 'nimbus' && item.color === 'Wine' ? { ...item, color: 'Red' } : item)
      : [];
  } catch (error) {
    console.warn('Could not read the saved cart.', error);
    return [];
  }
};

const readRoute = () => {
  const [path, query] = window.location.hash.replace(/^#/, '').split('?');
  const parts = (path || '/').split('/').filter(Boolean);
  const params = new URLSearchParams(query || '');
  if (parts[0] === 'product') return { page: 'product', id: parts[1] };
  if (parts[0] === 'collection') return { page: 'home', section: 'collection' };
  if (['cart', 'checkout', 'about', 'contact', 'login', 'signup', 'profile', 'forgot-password', 'reset-password', 'upcoming'].includes(parts[0])) return { page: parts[0] };
  if (params.get('page')) return { page: params.get('page'), id: params.get('id') };
  return { page: 'home' };
};

const getVariants = (product) => {
  if (product.id === 'nimbus') {
    const umbrellaVariants = defaultProducts.find((item) => item.id === 'nimbus')?.variants || [];
    return umbrellaVariants.map((variant) => (
      variant.color === product.color && product.image !== undefined
        ? { ...variant, image: product.image }
        : variant
    ));
  }

  if (!product.variants?.length) {
    return [{ name: product.name, color: product.color || 'Standard', image: product.image }];
  }

  return product.variants.map((variant, index) =>
    index === 0 && product.image !== undefined ? { ...variant, image: product.image } : variant
  );
};

function ProductImageSlider({ src, alt, className = '', slides, showControls = true }) {
  const [activeSlide, setActiveSlide] = useState(0);
  const imageSlides = slides?.length ? slides : [
    { src, alt, scale: 1, position: '50% 50%' },
    { src, alt, scale: 1.8, position: '50% 24%' },
    { src, alt, scale: 1.8, position: '50% 78%' },
  ];
  const currentSlide = imageSlides[activeSlide % imageSlides.length];
  const canSlide = showControls && imageSlides.length > 1;
  const changeSlide = (direction) => setActiveSlide((current) => (current + direction + imageSlides.length) % imageSlides.length);

  return (
    <div className={`image-slider ${className}`} aria-label={`${alt} image gallery`}>
      {src ? (
        <img
          src={currentSlide.src}
          alt={currentSlide.alt || alt}
          loading="lazy"
          style={{
            transform: `scale(${currentSlide.scale || 1})`,
            objectPosition: currentSlide.position || 'center',
          }}
        />
      ) : <div className="image-placeholder">Image coming soon</div>}
      {canSlide && (
        <>
          <button type="button" className="slider-arrow slider-previous" aria-label={`Previous ${alt} image`} onClick={() => changeSlide(-1)}>‹</button>
          <button type="button" className="slider-arrow slider-next" aria-label={`Next ${alt} image`} onClick={() => changeSlide(1)}>›</button>
          <div className="slider-dots" role="group" aria-label={`${alt} image slides`}>
            {imageSlides.map((slide, index) => (
              <button
                key={index}
                type="button"
                className={activeSlide === index ? 'active' : ''}
                aria-label={`Show ${slide.label || alt} image ${index + 1}`}
                aria-pressed={activeSlide === index}
                onClick={() => setActiveSlide(index)}
              />
            ))}
          </div>
          {currentSlide.label && <span className="slider-variant-label">{currentSlide.label}</span>}
        </>
      )}
    </div>
  );
}

function Header({ cartCount, theme, onToggleTheme, user, onLogout }) {
  return (
    <header className="store-header">
      <a className="store-brand" href="#/" aria-label="MAVORYI home">
        <span>MAVORYI</span>
        <small>PREMIUM ESSENTIALS</small>
      </a>
      <nav className="store-nav" aria-label="Main navigation">
        <a href="#/about">ABOUT</a>
        <a href="#/contact">CONTACT</a>
      </nav>
      <div className="header-controls">
        {user ? (
          <div className="user-menu">
            <a className="user-badge" href="#/profile" aria-label="Open your profile">
              <span className="avatar-mini" aria-hidden="true">{user.name.trim().charAt(0).toUpperCase()}</span>
              <span className="user-badge-copy"><strong>{user.name}</strong><small>Logged in as {user.name}</small></span>
            </a>
            <button type="button" className="logout-button" onClick={onLogout}>Log out</button>
          </div>
        ) : (
          <div className="auth-actions">
            <a className="login-link" href="#/login">Login</a>
            <a className="signup-link" href="#/signup">Sign Up</a>
          </div>
        )}
        <button
          className="theme-toggle"
          type="button"
          onClick={onToggleTheme}
          aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
          title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
        >
          {theme === 'dark' ? '☼' : '☾'}
        </button>
        <a className="cart-link" href="#/cart" aria-label={`Open cart, ${cartCount} items`}>
          <svg aria-hidden="true" viewBox="0 0 24 24" fill="none">
            <path d="M3 4h2l2.2 11.1a2 2 0 0 0 2 1.6h8.5a2 2 0 0 0 1.9-1.4L21 8H6" />
            <circle cx="10" cy="20" r="1" />
            <circle cx="18" cy="20" r="1" />
          </svg>
          <span className="cart-count" aria-live="polite">{cartCount}</span>
        </a>
      </div>
    </header>
  );
}

function ProductCard({ product }) {
  const firstVariant = getVariants(product)[0];
  const image = normalizeImage(firstVariant.image);
  const productUrl = `#/product/${encodeURIComponent(product.id)}`;
  const umbrellaSlides = product.id === 'nimbus'
    ? getVariants(product).map((variant) => ({
        src: normalizeImage(variant.image),
        alt: `${variant.name}, ${variant.color}`,
        label: variant.color,
      }))
    : undefined;
  return (
    <article className="product-card">
      <div className="product-card-image">
        <ProductImageSlider src={image} alt={firstVariant.name} slides={umbrellaSlides} />
        <a className="product-image-link" href={productUrl} aria-label={`View ${product.name} details`} />
        <span className="quick-view">VIEW DETAILS <span aria-hidden="true">↗</span></span>
      </div>
      <a className="product-card-link" href={productUrl}>
        <div className="product-card-content">
          <p className="product-category">{product.category}</p>
          <h3>{firstVariant.name}</h3>
          <p className="product-material">{product.material}</p>
          <strong className="product-price">{formatPrice(product.price)}</strong>
        </div>
      </a>
    </article>
  );
}

function MemberBanner({ user }) {
  return (
    <section className={user ? 'member-banner logged-in' : 'member-banner'} aria-label="MAVORYI account access">
      <div>
        <p className="eyebrow">{user ? 'MEMBER ACCESS' : 'YOUR MAVORYI ACCOUNT'}</p>
        <h2>{user ? `Welcome back, ${user.name}` : 'Join MAVORYI'}</h2>
        <p>{user ? 'You are logged in and ready for your personalized shopping experience.' : 'Log in to unlock exclusive access and a more personal shopping experience.'}</p>
      </div>
    </section>
  );
}

function Storefront({ products, loading, user }) {
  const [category, setCategory] = useState('All');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const categories = useMemo(() => ['All', ...new Set(products.map((product) => product.category))], [products]);
  const filtered = category === 'All' ? products : products.filter((product) => product.category === category);

  return (
    <main>
      <section className="hero-panel">
        <div className="hero-copy">
          <p className="eyebrow">THE MAVORYI COLLECTION</p>
          <h1>Made to move<br />with you.</h1>
          <p>Premium quality. Timeless design. Discover essentials for the road ahead.</p>
          <a className="primary-button hero-button" href="#/upcoming">EXPLORE UPCOMING COLLECTION</a>
        </div>
        <div className="hero-image" role="img" aria-label="MAVORYI emblem" style={{ '--hero-image': `url("${normalizeImage('M.jpg.jpeg')}")` }} />
      </section>
      <MemberBanner user={user} />

      <section className="catalog-panel" id="collection">
        <div className="section-heading">
          <div>
            <p className="eyebrow">CURATED FOR EVERYDAY</p>
            <h2>Featured products</h2>
          </div>
          <p>Thoughtful design, ready for wherever life takes you.</p>
        </div>
        <div className="filter-toolbar">
          <button type="button" className="filter-toggle" aria-label={filtersOpen ? 'Hide product filters' : 'Show product filters'} aria-expanded={filtersOpen} onClick={() => setFiltersOpen((open) => !open)}>
            <svg aria-hidden="true" viewBox="0 0 24 24" fill="none"><path d="M4 6h16M7 12h10m-7 6h4" /><circle cx="8" cy="6" r="2" /><circle cx="15" cy="12" r="2" /><circle cx="12" cy="18" r="2" /></svg>
            <span>Filter</span>
          </button>
          {filtersOpen && (
            <div className="catalog-toolbar" role="group" aria-label="Filter products by category">
              {categories.map((item) => (
                <button key={item} type="button" className={category === item ? 'filter-button active' : 'filter-button'} aria-pressed={category === item} onClick={() => setCategory(item)}>
                  {item}
                </button>
              ))}
            </div>
          )}
        </div>
        {loading ? <p className="notice">Loading collection…</p> : filtered.length ? (
          <div className="product-grid">
            {filtered.map((product) => <ProductCard key={product.id} product={product} />)}
          </div>
        ) : <p className="notice">No products in this category yet.</p>}
      </section>
      <section className="home-about">
        <p className="eyebrow">DESIGNED IN ACCRA</p>
        <h2>Everyday pieces.<br />Made with intention.</h2>
        {user && <a className="primary-button" href="#/profile">Explore member benefits</a>}
        <a className="secondary-button discover-button" href="#/about">Discover MAVORYI <span aria-hidden="true">→</span></a>
      </section>
    </main>
  );
}

function ProductDetail({ product, onAddToCart }) {
  const variants = product ? getVariants(product) : [];
  const [color, setColor] = useState(variants[0]?.color || '');
  const [added, setAdded] = useState(false);

  if (!product) {
    return <main className="page-main"><h1>Product not found</h1><a className="text-link" href="#/">Browse the collection</a></main>;
  }

  const variant = variants.find((item) => item.color === color) || variants[0];
  const image = normalizeImage(variant.image);
  const addItem = () => {
    onAddToCart(product, variant.color);
    setAdded(true);
    window.setTimeout(() => setAdded(false), 1400);
  };

  return (
    <main className="page-main">
      <section className="product-detail-layout">
        <ProductImageSlider src={image} alt={variant.name} className="product-detail-image" showControls={product.id !== 'nimbus'} />
        <div className="product-detail-copy">
          <p className="eyebrow">{product.category}</p>
          <h1>{variant.name}</h1>
          <p className="detail-price">{formatPrice(product.price)}</p>
          <p className="detail-description">{product.description || 'Designed for daily use with considered details and dependable materials.'}</p>
          {variants.length > 1 && (
            <label className="field-label" htmlFor="product-color">
              Colour
              <select id="product-color" value={variant.color} onChange={(event) => setColor(event.target.value)}>
                {variants.map((item) => <option key={item.color} value={item.color}>{item.name} — {item.color}</option>)}
              </select>
            </label>
          )}
          <dl className="product-specs">
            <div><dt>Colour</dt><dd>{variant.color}</dd></div>
            <div><dt>Material</dt><dd>{product.material || 'Details available on request'}</dd></div>
            <div><dt>Category</dt><dd>{product.category}</dd></div>
          </dl>
          <button type="button" className="primary-button detail-add-button" onClick={addItem}>{added ? 'Added to cart' : 'Add to cart'}</button>
          <a className="cart-discovery-link" href="#/cart">
            <span className="cart-discovery-icon" aria-hidden="true">＋</span>
            <span><strong>View your cart</strong><small>See your selected pieces</small></span>
            <span className="cart-discovery-arrow" aria-hidden="true">↗</span>
          </a>
        </div>
      </section>
    </main>
  );
}

function CartPage({ cart, products, onChangeQuantity, onRemove }) {
  const entries = cart.map((item) => {
    const product = products.find((entry) => entry.id === item.id);
    const variant = product ? getVariants(product).find((entry) => entry.color === item.color) || getVariants(product)[0] : null;
    return { item, product, variant };
  }).filter((entry) => entry.product);
  const itemCount = entries.reduce((sum, entry) => sum + Number(entry.item.quantity), 0);
  const totalKnown = entries.length > 0 && entries.every(({ product }) => Number.isFinite(Number(product.price)) && product.price !== null && product.price !== '');
  const total = totalKnown ? entries.reduce((sum, { product, item }) => sum + Number(product.price) * Number(item.quantity), 0) : null;

  return (
    <main className="page-main">
      <p className="eyebrow">MAVORYI SELECTION</p>
      <h1 className="page-title">Your cart</h1>
      {entries.length ? (
        <div className="cart-layout">
          <section className="cart-items" aria-label="Items in your cart">
            {entries.map(({ item, product, variant }) => {
              const image = normalizeImage(variant.image);
              return (
                <article className="cart-item" key={`${item.id}-${item.color}`}>
                  <a className="cart-item-image" href={`#/product/${encodeURIComponent(product.id)}`}>
                    {image ? <img src={image} alt={variant.name} /> : <div className="image-placeholder">Image coming soon</div>}
                  </a>
                  <div className="cart-item-info">
                    <a href={`#/product/${encodeURIComponent(product.id)}`}><h2>{variant.name}</h2></a>
                    <p className="cart-item-category">{product.category}</p>
                    <p>Colour: {item.color}{product.material ? ` · ${product.material}` : ''}</p>
                    <p>{formatPrice(product.price)} each</p>
                    <strong className="cart-item-total">
                      {Number.isFinite(Number(product.price)) && product.price !== null && product.price !== ''
                        ? formatPrice(Number(product.price) * Number(item.quantity))
                        : 'Price on request'}
                    </strong>
                    <div className="quantity-controls" aria-label={`Quantity for ${variant.name}`}>
                      <button type="button" aria-label="Decrease quantity" onClick={() => onChangeQuantity(item, -1)}>−</button>
                      <span>{item.quantity}</span>
                      <button type="button" aria-label="Increase quantity" onClick={() => onChangeQuantity(item, 1)}>+</button>
                      <button className="remove-button" type="button" onClick={() => onRemove(item)}>Remove</button>
                    </div>
                  </div>
                </article>
              );
            })}
          </section>
          <aside className="cart-summary">
            <h2>Order summary</h2>
            <div className="summary-line"><span>Items</span><span>{itemCount}</span></div>
            <div className="summary-line"><span>Delivery</span><span>Confirmed at checkout</span></div>
            <div className="summary-line summary-total"><span>Total</span><span>{formatPrice(total)}</span></div>
            <a className="primary-button checkout-button" href="#/checkout">Continue to checkout</a>
          </aside>
        </div>
      ) : (
        <div className="empty-cart">
          <h2>Your cart is empty</h2>
          <p>Choose an item from the collection to get started.</p>
        </div>
      )}
    </main>
  );
}

function CheckoutPage({ cart, products, onOrderComplete }) {
  const [timing, setTiming] = useState('on-delivery');
  const [contactMethod, setContactMethod] = useState('whatsapp');
  const [deliveryCity, setDeliveryCity] = useState('');
  const [message, setMessage] = useState('');
  const [fallbackUrl, setFallbackUrl] = useState('');
  const [fallbackLabel, setFallbackLabel] = useState('Contact MAVORYI on WhatsApp');
  const [submitting, setSubmitting] = useState(false);
  const entries = cart.map((item) => {
    const product = products.find((entry) => entry.id === item.id);
    const variant = product ? getVariants(product).find((entry) => entry.color === item.color) || getVariants(product)[0] : null;
    return product ? { item, product, variant } : null;
  }).filter(Boolean);
  const totalKnown = entries.length > 0 && entries.every(({ product }) => Number.isFinite(Number(product.price)) && product.price !== null && product.price !== '');
  const total = totalKnown ? entries.reduce((sum, { product, item }) => sum + Number(product.price) * Number(item.quantity), 0) : null;
  const isAccraDelivery = /\baccra\b/i.test(deliveryCity);

  const submitOrder = async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    if (!entries.length) {
      setMessage('Your cart is empty.');
      return;
    }

    const formData = new FormData(event.currentTarget);
    const customer = {
      name: String(formData.get('customer-name') || '').trim(),
      phone: String(formData.get('customer-phone') || '').trim(),
      email: String(formData.get('customer-email') || '').trim(),
      address: String(formData.get('delivery-address') || '').trim(),
      city: String(formData.get('delivery-city') || '').trim(),
    };
    const isAccraDelivery = /\baccra\b/i.test(customer.city);
    const orderItems = entries.map(({ item, product, variant }) => ({
      product_id: product.id,
      name: variant.name,
      color: item.color,
      quantity: Number(item.quantity),
      unit_price: product.price,
    }));
    const isPayOnDelivery = timing === 'on-delivery';
    const selectedContactMethod = isPayOnDelivery ? 'whatsapp' : contactMethod;
    const order = {
      items: orderItems,
      customer,
      paymentTiming: isPayOnDelivery ? 'on_delivery' : 'before_delivery',
      paymentMethod: isPayOnDelivery ? 'on-delivery' : 'other',
      deliveryFee: isPayOnDelivery || !isAccraDelivery ? null : 0,
      amount: isPayOnDelivery || !totalKnown ? null : total,
      currency: 'GHS',
    };
    const paymentLabel = isPayOnDelivery ? 'Pay on delivery' : 'Pay before delivery (payment method coming soon)';
    const deliveryLabel = isPayOnDelivery || !isAccraDelivery ? 'Delivery fee to be confirmed' : 'Free delivery in Accra';
    const whatsappText = [
      'MAVORYI ORDER',
      `Name: ${customer.name}`,
      `Phone: ${customer.phone}`,
      `Email: ${customer.email}`,
      `Delivery address: ${customer.address}`,
      `City/area: ${customer.city}`,
      `Payment: ${paymentLabel}`,
      `Payment contact: ${selectedContactMethod === 'email' ? 'Email' : 'WhatsApp'}`,
      `Delivery: ${deliveryLabel}`,
      'Items:',
      ...orderItems.map((item) => `${item.name} / ${item.color} x ${item.quantity}`),
    ].join('\n');
    const whatsappUrl = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(whatsappText)}`;
    const emailUrl = `mailto:${ADMIN_EMAIL}?subject=${encodeURIComponent(`MAVORYI order from ${customer.name}`)}&body=${encodeURIComponent(whatsappText)}`;
    const contactUrl = selectedContactMethod === 'email' ? emailUrl : whatsappUrl;
    const contactLabel = selectedContactMethod === 'email' ? 'Email MAVORYI' : 'Message MAVORYI on WhatsApp';
    const paymentWindow = isPayOnDelivery ? null : window.open('about:blank', '_blank');
    if (paymentWindow) paymentWindow.opener = null;

    setSubmitting(true);
    setMessage('');
    setFallbackUrl('');
    try {
      const { error } = await supabase.from('orders').insert({
        customer_name: customer.name,
        customer_phone: customer.phone,
        customer_email: customer.email || null,
        delivery_address: customer.address,
        delivery_city: customer.city,
        payment_timing: order.paymentTiming,
        payment_method: order.paymentMethod,
        payment_contact_method: isPayOnDelivery ? null : contactMethod,
        payment_status: 'unpaid',
        payment_provider: null,
        payment_reference: null,
        delivery_fee: order.deliveryFee,
        amount: order.amount,
        currency: order.currency,
        items: order.items,
      });
      if (error) throw error;
      const canOpenContact = Boolean(paymentWindow && !paymentWindow.closed);
      if (canOpenContact) paymentWindow.location.href = contactUrl;
      setFallbackUrl(!isPayOnDelivery && !canOpenContact ? contactUrl : '');
      setFallbackLabel(contactLabel);
      onOrderComplete();
      setMessage(isPayOnDelivery
        ? 'Order submitted successfully. MAVORYI will contact you to confirm delivery.'
        : canOpenContact
          ? `Order saved. Your ${selectedContactMethod === 'email' ? 'email' : 'WhatsApp'} message is ready to send.`
          : `Order saved. Use the link below to send your ${selectedContactMethod === 'email' ? 'email' : 'WhatsApp'} message.`);
      form.reset();
      setDeliveryCity('');
    } catch (error) {
      console.error('Could not submit the order.', error);
      const recoveryUrl = isPayOnDelivery ? whatsappUrl : contactUrl;
      const recoveryLabel = isPayOnDelivery ? 'Send order on WhatsApp' : contactLabel;
      const canOpenContact = Boolean(paymentWindow && !paymentWindow.closed);
      if (canOpenContact) paymentWindow.location.href = recoveryUrl;
      setFallbackUrl(canOpenContact ? '' : recoveryUrl);
      setFallbackLabel(recoveryLabel);
      setMessage(canOpenContact
        ? 'We could not save this order online. Your message is open; please send it so MAVORYI can process the order.'
        : 'We could not save this order online. Use the link below to send your order details to MAVORYI.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="page-main">
      <p className="eyebrow">ALMOST THERE</p>
      <h1 className="page-title">Checkout</h1>
      {!entries.length ? <div className="empty-cart"><h2>Your cart is empty</h2><p>Choose an item from the collection to get started.</p>{message && <p className="form-message" role="status">{message}</p>}{fallbackUrl && <a className="primary-button whatsapp-fallback" href={fallbackUrl} target="_blank" rel="noopener noreferrer">{fallbackLabel}</a>}</div> : (
        <div className="checkout-layout">
          <form className="checkout-form" onSubmit={submitOrder} onChange={() => {
            if (fallbackUrl) {
              setFallbackUrl('');
              setMessage('');
            }
          }}>
            <h2>Delivery details</h2>
            <label className="field-label">Name<input name="customer-name" autoComplete="name" required maxLength={120} /></label>
            <label className="field-label">Phone<input name="customer-phone" type="tel" autoComplete="tel" required maxLength={40} /></label>
            <label className="field-label">Email<input name="customer-email" type="email" autoComplete="email" maxLength={254} required /></label>
            <label className="field-label">Delivery address<textarea name="delivery-address" autoComplete="street-address" required maxLength={500} /></label>
            <label className="field-label">City or area<input name="delivery-city" autoComplete="address-level2" value={deliveryCity} onChange={(event) => setDeliveryCity(event.target.value)} required maxLength={120} /></label>
            <fieldset className="payment-choice">
              <legend>When would you like to pay?</legend>
              <label><input type="radio" name="payment-timing" value="on-delivery" checked={timing === 'on-delivery'} onChange={() => setTiming('on-delivery')} /> Pay on delivery <small>Delivery fee confirmed by MAVORYI</small></label>
              <label><input type="radio" name="payment-timing" value="before-delivery" checked={timing === 'before-delivery'} onChange={() => setTiming('before-delivery')} /> Pay before delivery <small>Free delivery in Accra; fee confirmed elsewhere</small></label>
            </fieldset>
            {timing === 'before-delivery' && (
              <>
                <section className="payment-coming-soon">
                  <p className="eyebrow">PREFERRED PAYMENT METHOD</p>
                  <p>Mobile money and bank payment options are coming soon. Submit your order and we’ll open WhatsApp or email so you can arrange payment with MAVORYI.</p>
                </section>
                <fieldset className="payment-choice">
                  <legend>How would you like to make payments?</legend>
                  <label><input type="radio" name="payment-contact" value="whatsapp" checked={contactMethod === 'whatsapp'} onChange={() => setContactMethod('whatsapp')} /> WhatsApp</label>
                  <label><input type="radio" name="payment-contact" value="email" checked={contactMethod === 'email'} onChange={() => setContactMethod('email')} /> Email</label>
                </fieldset>
              </>
            )}
            {message && <p className="form-message" role="status">{message}</p>}
            {fallbackUrl && <a className="primary-button whatsapp-fallback" href={fallbackUrl} target="_blank" rel="noopener noreferrer">{fallbackLabel}</a>}
            <button className="primary-button" type="submit" disabled={submitting}>{submitting ? 'Submitting…' : 'Submit order'}</button>
          </form>
          <aside className="cart-summary">
            <h2>Your order</h2>
            {entries.map(({ item, variant }) => <div className="summary-line" key={`${item.id}-${item.color}`}><span>{variant.name} × {item.quantity}</span><span>{item.color}</span></div>)}
            <div className="summary-line"><span>Delivery</span><span>{timing === 'before-delivery' && isAccraDelivery ? 'Free in Accra' : 'Fee to be confirmed'}</span></div>
            <div className="summary-line summary-total"><span>Total</span><span>{formatPrice(total)}</span></div>
            <a className="text-link" href="#/cart">← Edit cart</a>
          </aside>
        </div>
      )}
    </main>
  );
}

function LoginPage({ onLogin, message, busy }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  return (
    <main className="page-main auth-page">
      <form className="account-form" onSubmit={(event) => { event.preventDefault(); onLogin({ email, password }); }}>
        <p className="eyebrow">WELCOME BACK</p>
        <h1 className="page-title">Login to MAVORYI</h1>
        <p className="account-intro">Access your profile and personalized member experience.</p>
        {message && <p className="form-message" role="status">{message}</p>}
        <label className="field-label">Email<input type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} required /></label>
        <label className="field-label">Password<input type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} required /></label>
        <p className="account-recovery-link"><a href="#/forgot-password">Forgot your password?</a></p>
        <button className="primary-button" type="submit" disabled={busy}>{busy ? 'Signing in…' : 'Login'}</button>
        <p className="account-switch">Don't have an account? <a href="#/signup">Sign up</a></p>
      </form>
    </main>
  );
}

function ForgotPasswordPage({ onRequestReset, message, busy }) {
  const [email, setEmail] = useState('');

  return (
    <main className="page-main auth-page">
      <form className="account-form" onSubmit={(event) => {
        event.preventDefault();
        onRequestReset({ email });
      }}>
        <p className="eyebrow">ACCOUNT RECOVERY</p>
        <h1 className="page-title">Reset your password</h1>
        <p className="account-intro">Enter the email address for your account and we’ll send you a password reset link.</p>
        {message && <p className="form-message" role="status">{message}</p>}
        <label className="field-label">Email<input type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} required /></label>
        <button className="primary-button" type="submit" disabled={busy}>{busy ? 'Sending link…' : 'Send reset link'}</button>
        <p className="account-switch"><a href="#/login">Back to login</a></p>
      </form>
    </main>
  );
}

function ResetPasswordPage({ onResetPassword, message, busy }) {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  return (
    <main className="page-main auth-page">
      <form className="account-form" onSubmit={(event) => {
        event.preventDefault();
        onResetPassword({ password, confirmPassword });
      }}>
        <p className="eyebrow">ACCOUNT RECOVERY</p>
        <h1 className="page-title">Choose a new password</h1>
        <p className="account-intro">Use at least 8 characters for your new password.</p>
        {message && <p className="form-message" role="status">{message}</p>}
        <label className="field-label">New password<input type="password" autoComplete="new-password" minLength={8} value={password} onChange={(event) => setPassword(event.target.value)} required /></label>
        <label className="field-label">Confirm new password<input type="password" autoComplete="new-password" minLength={8} value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} required /></label>
        <button className="primary-button" type="submit" disabled={busy}>{busy ? 'Updating password…' : 'Update password'}</button>
      </form>
    </main>
  );
}

function SignupPage({ onSignup, message, busy }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  return (
    <main className="page-main auth-page">
      <form className="account-form" onSubmit={(event) => { event.preventDefault(); onSignup({ name, email, password, confirmPassword }); }}>
        <p className="eyebrow">BECOME A MEMBER</p>
        <h1 className="page-title">Join MAVORYI</h1>
        <p className="account-intro">Create your account for a more personal shopping experience.</p>
        {message && <p className="form-message" role="status">{message}</p>}
        <label className="field-label">Full name<input type="text" autoComplete="name" maxLength={120} value={name} onChange={(event) => setName(event.target.value)} required /></label>
        <label className="field-label">Email<input type="email" autoComplete="email" maxLength={254} value={email} onChange={(event) => setEmail(event.target.value)} required /></label>
        <label className="field-label">Password<input type="password" autoComplete="new-password" minLength={8} value={password} onChange={(event) => setPassword(event.target.value)} required /></label>
        <label className="field-label">Confirm password<input type="password" autoComplete="new-password" minLength={8} value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} required /></label>
        <button className="primary-button" type="submit" disabled={busy}>{busy ? 'Creating account…' : 'Create account'}</button>
        <p className="account-switch">Already have an account? <a href="#/login">Login</a></p>
      </form>
    </main>
  );
}

function ProfilePage({ user, loading, message, onUpdate, onLogout, busy }) {
  const [isEditing, setIsEditing] = useState(false);
  const [name, setName] = useState(user?.name || '');
  const [email, setEmail] = useState(user?.email || '');
  const createdDate = user?.created_at ? new Date(user.created_at).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' }) : 'Not available';

  if (loading) return <main className="page-main"><p className="notice" role="status">Checking your account…</p></main>;
  if (!user) {
    return (
      <main className="page-main">
        <div className="empty-cart"><h1>Your profile</h1><p>Log in to view your account details and member space.</p><a className="primary-button" href="#/login">Login to Continue</a></div>
      </main>
    );
  }

  return (
    <main className="page-main profile-page">
      <p className="eyebrow">MEMBER PROFILE</p>
      <h1 className="page-title">Welcome back, {user.name}</h1>
      {message && <p className="form-message" role="status">{message}</p>}
      <section className="profile-card">
        <div className="profile-summary">
          <div className="profile-avatar" aria-hidden="true">{user.name.trim().charAt(0).toUpperCase()}</div>
          <div><p className="eyebrow">LOGGED IN AS</p><h2>{user.name}</h2><p>{user.email}</p></div>
        </div>
        <dl className="profile-details">
          <div><dt>Member name</dt><dd>{user.name}</dd></div>
          <div><dt>Email address</dt><dd>{user.email}</dd></div>
          <div><dt>Account created</dt><dd>{createdDate}</dd></div>
        </dl>
        <div className="profile-actions">
          <button type="button" className="secondary-button" onClick={() => setIsEditing((editing) => !editing)}>{isEditing ? 'Cancel edit' : 'Edit Profile'}</button>
          <button type="button" className="secondary-button" onClick={onLogout} disabled={busy}>{busy ? 'Signing out…' : 'Logout'}</button>
        </div>
      </section>
      {isEditing && (
        <form className="account-form profile-edit-form" onSubmit={(event) => { event.preventDefault(); onUpdate({ name, email }); }}>
          <p className="eyebrow">UPDATE DETAILS</p><h2>Edit profile information</h2>
          <label className="field-label">Full name<input value={name} onChange={(event) => setName(event.target.value)} maxLength={120} required /></label>
          <label className="field-label">Email<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} maxLength={254} required /></label>
          <button className="primary-button" type="submit" disabled={busy}>{busy ? 'Saving…' : 'Save changes'}</button>
        </form>
      )}
    </main>
  );
}

function AboutPage() {
  return (
    <main className="page-main content-page about-page">
      <p className="eyebrow">OUR STORY</p>
      <h1 className="page-title">ABOUT MAVORYI</h1>
      <p className="page-lead">MAVORYI is a Ghanaian lifestyle brand. Creators of THE ROAMER, THE VOYAGER, THE NOMAD, THE HAULER, THE INFERNO HELMET and THE NIMBUS. Original packs, duffels, helmets and umbrellas designed in Accra. Also home to Casa di Mavoryi.</p>
      <div className="info-grid">
        <section className="info-panel"><h2>Our approach</h2><p>We believe great product is earned. It's in the weight of the handle, the strength of the frame, the quiet confidence of something made right. We obsess over these details so you don't have to.</p></section>
        <section className="info-panel"><h2>Our promise</h2><p>To stand behind every piece we put our name on. To deliver quality you can feel in hand, performance you can trust in rain, and design that stays with you over time.</p></section>
      </div>
      <section className="inside-panel"><img src={normalizeImage('img16.jpeg')} alt="Inside MAVORYI" /><div><p className="eyebrow">MADE IN ACCRA</p><h2>Inside MAVORYI</h2></div></section>
    </main>
  );
}

function ContactPage() {
  const [name, setName] = useState('');
  const [message, setMessage] = useState('');
  const whatsappUrl = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(`${message.trim()}\n\nFrom: ${name.trim()}`)}`;
  const emailUrl = `mailto:${ADMIN_EMAIL}?subject=${encodeURIComponent(`Message from ${name.trim()} - MAVORYI`)}&body=${encodeURIComponent(`${message.trim()}\n\nFrom: ${name.trim()}`)}`;

  return (
    <main className="page-main content-page">
      <p className="eyebrow">WE’RE HERE TO HELP</p>
      <h1 className="page-title">Contact</h1>
      <p className="page-lead">Have a question about a collection or product? Send us a message and our team will get back to you.</p>
      <form className="contact-form" onSubmit={(event) => { event.preventDefault(); window.open(whatsappUrl, '_blank', 'noopener,noreferrer'); }}>
        <label className="field-label">Name<input name="name" value={name} onChange={(event) => setName(event.target.value)} required /></label>
        <label className="field-label">Message<textarea name="message" value={message} onChange={(event) => setMessage(event.target.value)} required /></label>
        <div className="contact-actions">
          <button className="primary-button" type="submit">Send on WhatsApp</button>
          <a className="secondary-button" href={emailUrl}>Email us</a>
        </div>
      </form>
    </main>
  );
}

function UpcomingPage({ user, authLoading }) {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const userId = user?.id;

  useEffect(() => {
    if (authLoading || !userId) return undefined;
    let active = true;

    const loadUpcomingProducts = async () => {
      try {
        const { data, error: queryError } = await supabase
          .from('upcoming_products')
          .select('id, name, category, description, image, color, material, expected_release')
          .order('created_at', { ascending: false });
        if (queryError) throw queryError;
        if (active) setProducts(data || []);
      } catch (queryError) {
        console.error('Could not load the upcoming collection.', queryError);
        if (active) setError('The upcoming collection is unavailable. Please try again later.');
      } finally {
        if (active) setLoading(false);
      }
    };

    loadUpcomingProducts();
    return () => { active = false; };
  }, [authLoading, userId]);

  if (authLoading) {
    return <main className="page-main"><p className="notice" role="status">Checking your member access…</p></main>;
  }

  if (!user) {
    return (
      <main className="page-main upcoming-locked">
        <div className="upcoming-access-overlay">
          <section className="upcoming-access-modal" role="dialog" aria-modal="true" aria-labelledby="upcoming-access-title" aria-describedby="upcoming-access-description">
            <p className="eyebrow">MEMBERS ONLY</p>
            <h1 id="upcoming-access-title">Please log in to continue</h1>
            <p id="upcoming-access-description">Create an account or sign in to view the upcoming collection.</p>
            <div className="lookbook-gate-actions">
              <a className="primary-button" href="#/login" onClick={() => sessionStorage.setItem(UPCOMING_RETURN_KEY, 'true')}>Log in</a>
              <a className="secondary-button" href="#/signup" onClick={() => sessionStorage.setItem(UPCOMING_RETURN_KEY, 'true')}>Create an account</a>
            </div>
            <button className="upcoming-access-close" type="button" onClick={() => { window.location.hash = '#/collection'; }}>Not now</button>
          </section>
        </div>
      </main>
    );
  }

  return (
    <main className="page-main lookbook-page">
      <section className="lookbook-heading">
        <p className="eyebrow">EXCLUSIVE MEMBER PREVIEW</p>
        <h1 className="page-title">Upcoming collection</h1>
        <p className="page-lead">A first look at what MAVORYI is creating next. These pieces are for viewing only and are not available to buy.</p>
      </section>
      {loading ? <p className="notice" role="status">Loading upcoming products…</p> : null}
      {error && <p className="form-message" role="alert">{error}</p>}
      {!loading && !error && products.length === 0 && (
        <p className="notice">New pieces are being prepared for this collection. Please check back soon.</p>
      )}
      {!loading && products.length > 0 && (
        <section className="lookbook-grid" aria-label="Upcoming products">
          {products.map((product) => (
            <article className="lookbook-card" key={product.id}>
              <div className="lookbook-image">
                {product.image
                  ? <img src={normalizeImage(product.image)} alt={product.name} loading="lazy" />
                  : <div className="image-placeholder">A first look is coming soon</div>}
                <span className="lookbook-badge">PREVIEW ONLY</span>
              </div>
              <div className="lookbook-copy">
                <p className="product-category">{product.category}</p>
                <h2>{product.name}</h2>
                <p>{product.description}</p>
                {(product.color || product.material) && (
                  <dl className="lookbook-details">
                    {product.color && <div><dt>Colour</dt><dd>{product.color}</dd></div>}
                    {product.material && <div><dt>Material</dt><dd>{product.material}</dd></div>}
                  </dl>
                )}
                {product.expected_release && <p className="lookbook-release">Expected {product.expected_release}</p>}
              </div>
            </article>
          ))}
        </section>
      )}
    </main>
  );
}

function CustomerApp() {
  const [products, setProducts] = useState(() => loadProducts());
  const [loading, setLoading] = useState(true);
  const [cart, setCart] = useState(readCart);
  const [route, setRoute] = useState(readRoute);
  const [theme, setTheme] = useState(() => localStorage.getItem('mavoryi-theme') === 'light' ? 'light' : 'dark');
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authBusy, setAuthBusy] = useState(false);
  const [authMessage, setAuthMessage] = useState('');
  const cartCount = cart.reduce((sum, item) => sum + Number(item.quantity || 0), 0);

  useEffect(() => {
    let active = true;
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!active) return;
      setUser(toCustomerUser(session?.user));
      setAuthLoading(false);
      if (event === 'PASSWORD_RECOVERY') window.location.hash = '#/reset-password';
      else if (session?.user && ['INITIAL_SESSION', 'SIGNED_IN'].includes(event) && sessionStorage.getItem(UPCOMING_RETURN_KEY) === 'true') {
        sessionStorage.removeItem(UPCOMING_RETURN_KEY);
        window.location.hash = '#/upcoming';
      }
    });
    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!user?.id) return undefined;
    let active = true;
    let updating = false;
    const updateCustomerActivity = async () => {
      if (!active || updating || document.visibilityState !== 'visible') return;
      updating = true;
      try {
        const { error } = await supabase.rpc('touch_customer_activity');
        if (error) throw error;
      } catch (error) {
        console.error('Could not update customer activity.', error);
      } finally {
        updating = false;
      }
    };
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') updateCustomerActivity();
    };

    updateCustomerActivity();
    const intervalId = window.setInterval(updateCustomerActivity, 5 * 60 * 1000);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      active = false;
      window.clearInterval(intervalId);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [user?.id]);

  useEffect(() => {
    const updateRoute = () => setRoute(readRoute());
    window.addEventListener('hashchange', updateRoute);
    return () => window.removeEventListener('hashchange', updateRoute);
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('mavoryi-theme', theme);
  }, [theme]);

  useEffect(() => {
    try {
      localStorage.setItem(CART_KEY, JSON.stringify(cart));
    } catch (error) {
      console.error('Could not save the cart.', error);
    }
  }, [cart]);

  useEffect(() => {
    let active = true;
    const trackVisitor = async () => {
      try {
        const visitDate = new Date().toISOString().slice(0, 10);
        const savedIdentity = JSON.parse(localStorage.getItem(VISITOR_ID_STORAGE_KEY) || 'null');
        let visitorId = savedIdentity?.date === visitDate ? savedIdentity.id : '';
        if (!visitorId) {
          if (!window.crypto?.randomUUID) throw new Error('Secure browser ID generation is unavailable.');
          visitorId = window.crypto.randomUUID();
          localStorage.setItem(VISITOR_ID_STORAGE_KEY, JSON.stringify({ date: visitDate, id: visitorId }));
        }

        const { error } = await supabase.from('site_visits').insert({ visitor_id: visitorId });
        if (error && error.code !== '23505') throw error;
      } catch (error) {
        if (active) console.warn('Could not record anonymous visitor analytics.', error);
      }
    };

    trackVisitor();
    return () => { active = false; };
  }, []);

  useEffect(() => {
    let active = true;
    const loadCatalog = async () => {
      try {
        const { data, error } = await supabase.from('products').select('id, name, category, image, color, material, description, price').eq('active', true).order('position', { ascending: true });
        if (error) throw error;
        if (active && Array.isArray(data) && data.length) {
          const localById = Object.fromEntries(loadProducts().map((product) => [product.id, product]));
          const catalog = data.map((product) => ({ ...localById[product.id], ...product }));
          setProducts(catalog);
          saveProducts(catalog);
        }
      } catch (error) {
        console.warn('Could not load the live catalog; using the saved catalog.', error);
      } finally {
        if (active) setLoading(false);
      }
    };
    loadCatalog();
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (route.page === 'home' && route.section === 'collection') {
      document.getElementById('collection')?.scrollIntoView({ behavior: 'smooth' });
      return;
    }

    window.scrollTo({ top: 0, behavior: 'auto' });
  }, [route.page, route.id, route.section]);

  const addToCart = (product, color) => {
    setCart((current) => {
      const match = current.find((item) => item.id === product.id && item.color === color);
      return match
        ? current.map((item) => item === match ? { ...item, quantity: Number(item.quantity) + 1 } : item)
        : [...current, { id: product.id, color, quantity: 1 }];
    });
  };
  const changeQuantity = (target, delta) => setCart((current) => current.map((item) =>
    item.id === target.id && item.color === target.color ? { ...item, quantity: Number(item.quantity) + delta } : item
  ).filter((item) => item.quantity > 0));
  const removeFromCart = (target) => setCart((current) => current.filter((item) => !(item.id === target.id && item.color === target.color)));
  const product = products.find((item) => item.id === route.id);

  const login = async ({ email, password }) => {
    const returnToUpcoming = sessionStorage.getItem(UPCOMING_RETURN_KEY) === 'true';
    setAuthBusy(true);
    setAuthMessage('');
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
      });
      if (error) throw error;
      setUser(toCustomerUser(data.user));
      setAuthMessage('Welcome back.');
      if (returnToUpcoming) sessionStorage.removeItem(UPCOMING_RETURN_KEY);
      window.location.hash = returnToUpcoming ? '#/upcoming' : '#/profile';
      return true;
    } catch (error) {
      console.error('Could not sign in the customer.', error);
      setAuthMessage(error.message || 'Sign-in failed. Check your email and password.');
      return false;
    } finally {
      setAuthBusy(false);
    }
  };

  const requestPasswordReset = async ({ email }) => {
    setAuthBusy(true);
    setAuthMessage('');
    try {
      const redirectTo = new URL(window.location.pathname, window.location.origin).toString();
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), { redirectTo });
      if (error) throw error;
      setAuthMessage('If an account exists for that email, a password reset link has been sent.');
      return true;
    } catch (error) {
      console.error('Could not send a password reset email.', error);
      setAuthMessage(error.message || 'Could not send the reset link. Please try again.');
      return false;
    } finally {
      setAuthBusy(false);
    }
  };

  const resetPassword = async ({ password, confirmPassword }) => {
    setAuthBusy(true);
    setAuthMessage('');
    try {
      if (password.length < 8) throw new Error('Password must be at least 8 characters long.');
      if (password !== confirmPassword) throw new Error('Passwords do not match.');

      const { data, error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      setUser(toCustomerUser(data.user));
      setAuthMessage('Your password has been updated.');
      window.location.hash = '#/profile';
      return true;
    } catch (error) {
      console.error('Could not reset the customer password.', error);
      setAuthMessage(error.message || 'Password reset failed. Request a new reset link and try again.');
      return false;
    } finally {
      setAuthBusy(false);
    }
  };

  const signup = async ({ name, email, password, confirmPassword }) => {
    const returnToUpcoming = sessionStorage.getItem(UPCOMING_RETURN_KEY) === 'true';
    setAuthBusy(true);
    setAuthMessage('');
    try {
      const normalizedName = name.trim();
      const normalizedEmail = email.trim().toLowerCase();
      if (!normalizedName || normalizedName.length > 120) {
        throw new Error('Please enter your name (up to 120 characters).');
      }
      if (password.length < 8) {
        throw new Error('Password must be at least 8 characters long.');
      }
      if (password !== confirmPassword) {
        throw new Error('Passwords do not match.');
      }

      const { data, error } = await supabase.auth.signUp({
        email: normalizedEmail,
        password,
        options: {
          data: { name: normalizedName },
          ...(returnToUpcoming ? { emailRedirectTo: `${window.location.origin}${window.location.pathname}#/upcoming` } : {}),
        },
      });
      if (error) throw error;
      if (!data.user) throw new Error('Your account could not be created. Please try again.');

      if (data.session) {
        setUser(toCustomerUser(data.user));
        setAuthMessage('Your account has been created.');
        if (returnToUpcoming) sessionStorage.removeItem(UPCOMING_RETURN_KEY);
        window.location.hash = returnToUpcoming ? '#/upcoming' : '#/profile';
      } else {
        setAuthMessage('Account created. Check your email to confirm your address, then log in.');
      }
      return true;
    } catch (error) {
      console.error('Could not create the customer account.', error);
      setAuthMessage(error.message || 'Account creation failed. Please try again.');
      return false;
    } finally {
      setAuthBusy(false);
    }
  };

  const updateProfile = async ({ name, email }) => {
    setAuthBusy(true);
    setAuthMessage('');
    try {
      const normalizedName = name.trim();
      const normalizedEmail = email.trim().toLowerCase();
      if (!normalizedName || normalizedName.length > 120) {
        throw new Error('Please enter your name (up to 120 characters).');
      }

      const emailChanged = normalizedEmail !== (user?.email || '').toLowerCase();
      const update = { data: { name: normalizedName } };
      if (emailChanged) update.email = normalizedEmail;

      const { data, error } = await supabase.auth.updateUser(update);
      if (error) throw error;
      setUser(toCustomerUser(data.user));
      setAuthMessage(emailChanged
        ? 'Your name was updated. Check your email to confirm the new address.'
        : 'Profile updated successfully.');
      return true;
    } catch (error) {
      console.error('Could not update the customer profile.', error);
      setAuthMessage(error.message || 'Profile update failed. Please try again.');
      return false;
    } finally {
      setAuthBusy(false);
    }
  };

  const logout = async () => {
    setAuthBusy(true);
    setAuthMessage('');
    try {
      const { error } = await supabase.auth.signOut({ scope: 'local' });
      if (error) throw error;
      setUser(null);
      setAuthMessage('You have been signed out.');
      window.location.hash = '#/';
    } catch (error) {
      console.error('Could not sign out the customer.', error);
      setAuthMessage(error.message || 'Sign-out failed. Please try again.');
    } finally {
      setAuthBusy(false);
    }
  };

  const page = (() => {
    switch (route.page) {
      case 'product': return <ProductDetail key={product?.id || route.id} product={product} onAddToCart={addToCart} />;
      case 'cart': return <CartPage cart={cart} products={products} onChangeQuantity={changeQuantity} onRemove={removeFromCart} />;
      case 'checkout': return <CheckoutPage cart={cart} products={products} onOrderComplete={() => setCart([])} />;
      case 'about': return <AboutPage />;
      case 'contact': return <ContactPage />;
      case 'upcoming': return <UpcomingPage key={user?.id || 'guest'} user={user} authLoading={authLoading} />;
      case 'login': return <LoginPage message={authMessage} busy={authBusy} onLogin={login} />;
      case 'forgot-password': return <ForgotPasswordPage message={authMessage} busy={authBusy} onRequestReset={requestPasswordReset} />;
      case 'reset-password': return <ResetPasswordPage message={authMessage} busy={authBusy} onResetPassword={resetPassword} />;
      case 'signup': return <SignupPage message={authMessage} busy={authBusy} onSignup={signup} />;
      case 'profile': return <ProfilePage key={user?.id || 'guest'} user={user} loading={authLoading} message={authMessage} busy={authBusy} onUpdate={updateProfile} onLogout={logout} />;
      default: return <Storefront products={products} loading={loading} user={user} />;
    }
  })();

  return (
    <div className="app-shell">
      <Header cartCount={cartCount} theme={theme} onToggleTheme={() => setTheme((current) => current === 'dark' ? 'light' : 'dark')} user={user} onLogout={logout} />
      {page}
      <footer className="store-footer">
        <a href="#/">MAVORYI</a>
        <a className="store-footer-featured luxury-button" href="#/collection">Back to featured products</a>
        <span>Designed in Accra. Made to move with you.</span>
        <span className="visitor-analytics-note">Daily visit counts use an anonymous browser ID and do not include your name, email, or IP address. For signed-in accounts, we record your last storefront activity for member account management.</span>
      </footer>
    </div>
  );
}

function App() {
  return window.location.pathname.endsWith('/admin.html')
    ? <Suspense fallback={<main className="page-main"><p className="notice" role="status">Loading admin dashboard…</p></main>}><AdminPortal /></Suspense>
    : <CustomerApp />;
}

export default App;
