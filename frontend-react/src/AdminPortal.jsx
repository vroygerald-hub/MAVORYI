import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { adminSupabase as supabase } from './lib/adminSupabase';
import { loadProducts, saveProducts } from './utils/catalogStorage';
import './AdminPortal.css';

const ORDER_STATUSES = [
  ['new', 'New'],
  ['confirmed', 'Confirmed'],
  ['preparing', 'Preparing'],
  ['out_for_delivery', 'Out for delivery'],
  ['delivered', 'Delivered'],
  ['cancelled', 'Cancelled'],
];

const CUSTOMER_ACTIVE_WINDOW_MS = 30 * 60 * 1000;
const CUSTOMER_NEW_ACCOUNT_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;

const isCustomerActive = (customer, now = Date.now()) => {
  const lastActiveAt = Date.parse(customer.last_active_at || '');
  return Number.isFinite(lastActiveAt) && lastActiveAt >= now - CUSTOMER_ACTIVE_WINDOW_MS;
};

const isNewCustomer = (customer, now = Date.now()) => {
  const createdAt = Date.parse(customer.created_at || '');
  return Number.isFinite(createdAt) && createdAt >= now - CUSTOMER_NEW_ACCOUNT_WINDOW_MS;
};

const PAYMENT_METHODS = {
  'mtn-momo': 'MTN Mobile Money',
  momo: 'Mobile Money',
  'telecel-cash': 'Telecel Cash',
  'access-bank': 'Access Bank',
  'on-delivery': 'Pay on delivery',
  'legacy-online': 'Online payment (legacy)',
  other: 'Payment method coming soon',
};

const EMPTY_PRODUCT_DRAFT = {
  name: '',
  category: '',
  image: '',
  color: '',
  material: '',
  description: '',
  price: '',
};

const EMPTY_UPCOMING_DRAFT = {
  name: '',
  category: '',
  description: '',
  image: '',
  color: '',
  material: '',
  expected_release: '',
};

const formatMoney = (amount, currency = 'GHS') => {
  if (amount === null || amount === undefined || amount === '') return 'To be confirmed';
  const value = Number(amount);
  return Number.isFinite(value)
    ? `${currency} ${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    : 'To be confirmed';
};

const formatDate = (value) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Date unavailable' : date.toLocaleString();
};

const slugifyProductName = (value) => value
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .trim()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-|-$/g, '');

const resolveProductImage = (value) => {
  const image = String(value || '').trim();
  if (!image) return '';
  if (/^https?:\/\//i.test(image) || image.startsWith('/')) return image;
  return new URL(`${import.meta.env.BASE_URL}images/${encodeURI(image)}`, document.baseURI).toString();
};

const syncLocalCatalog = (catalog) => {
  const savedById = new Map(loadProducts().map((product) => [product.id, product]));
  saveProducts(catalog.map((product) => ({
    ...savedById.get(product.id),
    ...product,
  })));
};

function VisitorChart({ days }) {
  const width = 720;
  const chartHeight = 210;
  const chartTop = 18;
  const chartBottom = 174;
  const chartLeft = 44;
  const barSlot = 22;
  const barWidth = 12;
  const maxCount = Math.max(1, ...days.map((day) => day.count));
  const datesToLabel = new Set([0, 7, 14, 21, 28, 29]);

  return (
    <div className="admin-visitor-chart">
      <svg viewBox={`0 0 ${width} ${chartHeight}`} role="img" aria-labelledby="visitor-chart-title visitor-chart-description">
        <title id="visitor-chart-title">Daily unique browsers over the past 30 days</title>
        <desc id="visitor-chart-description">A bar chart of anonymous unique browser counts by UTC day.</desc>
        {[0, 1, 2, 3].map((step) => {
          const y = chartTop + ((chartBottom - chartTop) / 3) * step;
          const label = Math.round(maxCount * (3 - step) / 3);
          return (
            <g key={step}>
              <line x1={chartLeft} x2={width - 10} y1={y} y2={y} className="admin-chart-gridline" />
              <text x={chartLeft - 8} y={y + 4} textAnchor="end" className="admin-chart-axis-label">{label}</text>
            </g>
          );
        })}
        {days.map((day, index) => {
          const barHeight = day.count ? Math.max(2, ((chartBottom - chartTop) * day.count) / maxCount) : 0;
          const x = chartLeft + index * barSlot + (barSlot - barWidth) / 2;
          const tickLabel = new Date(`${day.date}T00:00:00Z`).toLocaleDateString(undefined, {
            month: 'short',
            day: 'numeric',
            timeZone: 'UTC',
          });
          return (
            <g key={day.date}>
              <rect
                x={x}
                y={chartBottom - barHeight}
                width={barWidth}
                height={barHeight}
                rx="2"
                className="admin-chart-bar"
              >
                <title>{`${day.date}: ${day.count} unique browser${day.count === 1 ? '' : 's'}`}</title>
              </rect>
              {datesToLabel.has(index) && (
                <text x={x + barWidth / 2} y={chartBottom + 20} textAnchor="middle" className="admin-chart-date-label">{tickLabel}</text>
              )}
            </g>
          );
        })}
      </svg>
      <div className="sr-only">
        <ul>{days.map((day) => <li key={day.date}>{day.date}: {day.count} unique browsers</li>)}</ul>
      </div>
    </div>
  );
};

function OrderCard({ order, onUpdateStatus, saving }) {
  const [status, setStatus] = useState(order.status);
  const paymentMethod = PAYMENT_METHODS[order.payment_method] || order.payment_method;
  const paymentContact = order.payment_contact_method ? `Contact via ${order.payment_contact_method === 'email' ? 'Email' : 'WhatsApp'}; ` : '';
  const paymentDetails = order.payment_timing === 'on_delivery'
    ? `${paymentMethod}; delivery fee ${formatMoney(order.delivery_fee)}; ${order.payment_status || 'unpaid'}`
    : `Pay before delivery; ${order.delivery_fee === 0 ? 'free delivery in Accra' : 'delivery fee to be confirmed'}; ${paymentMethod}; ${paymentContact}${order.payment_status || 'unpaid'}${order.payment_reference ? `; ref ${order.payment_reference}` : ''}`;

  return (
    <article className="admin-order-card">
      <div className="admin-order-heading">
        <div>
          <p className="admin-order-date">{formatDate(order.created_at)}</p>
          <h3>{order.customer_name || 'Customer'}</h3>
          <p className="admin-order-reference">Order {String(order.id).slice(0, 8)}</p>
        </div>
        <span className={`admin-status-badge status-${order.status}`}>{order.status.replaceAll('_', ' ')}</span>
      </div>

      <div className="admin-order-details">
        <div>
          <span className="admin-detail-label">Customer contact</span>
          <a href={`tel:${order.customer_phone}`}>{order.customer_phone}</a>
          {order.customer_email && <a href={`mailto:${order.customer_email}`}>{order.customer_email}</a>}
        </div>
        <div>
          <span className="admin-detail-label">Delivery address</span>
          <span>{order.delivery_address}, {order.delivery_city}</span>
        </div>
        <div>
          <span className="admin-detail-label">Payment</span>
          <span>{paymentDetails}</span>
          {order.amount !== null && order.amount !== undefined && (
            <strong>{formatMoney(order.amount, order.currency)}</strong>
          )}
        </div>
      </div>

      <div className="admin-order-items">
        <span className="admin-detail-label">Items</span>
        {Array.isArray(order.items) && order.items.length ? (
          <ul>
            {order.items.map((item, index) => (
              <li key={`${item.id || item.name || 'item'}-${index}`}>
                <span>{item.name || 'Product'}{item.color ? ` / ${item.color}` : ''}</span>
                <strong>× {item.quantity || 1}</strong>
              </li>
            ))}
          </ul>
        ) : <p>No item details available.</p>}
      </div>

      <form className="admin-status-form" onSubmit={(event) => {
        event.preventDefault();
        onUpdateStatus(order.id, status);
      }}>
        <label>
          Order status
          <select value={status} onChange={(event) => setStatus(event.target.value)}>
            {ORDER_STATUSES.map(([value, label]) => <option value={value} key={value}>{label}</option>)}
          </select>
        </label>
        <button className="admin-primary-button" type="submit" disabled={saving || status === order.status}>
          {saving ? 'Saving…' : status === 'confirmed' && order.status !== 'confirmed' ? 'Confirm order' : 'Update status'}
        </button>
      </form>
    </article>
  );
}

function AdminPortal() {
  const [authorized, setAuthorized] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);
  const [authBusy, setAuthBusy] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loginMessage, setLoginMessage] = useState('');
  const [orders, setOrders] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [products, setProducts] = useState([]);
  const [upcomingProducts, setUpcomingProducts] = useState([]);
  const [priceDrafts, setPriceDrafts] = useState({});
  const [productDraft, setProductDraft] = useState({ ...EMPTY_PRODUCT_DRAFT });
  const [productEditDraft, setProductEditDraft] = useState({ ...EMPTY_PRODUCT_DRAFT });
  const [editingProductId, setEditingProductId] = useState('');
  const [upcomingDraft, setUpcomingDraft] = useState({ ...EMPTY_UPCOMING_DRAFT });
  const [editingUpcomingId, setEditingUpcomingId] = useState('');
  const [isProductFormOpen, setIsProductFormOpen] = useState(false);
  const [isAddingProduct, setIsAddingProduct] = useState(false);
  const [isSavingProductDetails, setIsSavingProductDetails] = useState(false);
  const [isSavingUpcoming, setIsSavingUpcoming] = useState(false);
  const [visitorDays, setVisitorDays] = useState([]);
  const [activeTab, setActiveTab] = useState('overview');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [customerSearch, setCustomerSearch] = useState('');
  const [customerFilter, setCustomerFilter] = useState('all');
  const [dashboardLoading, setDashboardLoading] = useState(false);
  const [customersLoading, setCustomersLoading] = useState(false);
  const [ordersError, setOrdersError] = useState('');
  const [customersError, setCustomersError] = useState('');
  const [productsError, setProductsError] = useState('');
  const [upcomingProductsError, setUpcomingProductsError] = useState('');
  const [visitorsError, setVisitorsError] = useState('');
  const [notice, setNotice] = useState('');
  const [liveStatus, setLiveStatus] = useState('Live updates connect after admin sign-in.');
  const [newOrderNotice, setNewOrderNotice] = useState('');
  const [savingOrderId, setSavingOrderId] = useState('');
  const [savingProductId, setSavingProductId] = useState('');
  const sessionWasAuthorized = useRef(false);

  const refreshOrders = useCallback(async () => {
    setOrdersError('');
    try {
      const { data, error } = await supabase
        .from('orders')
        .select('id, customer_name, customer_phone, customer_email, delivery_address, delivery_city, payment_timing, payment_method, payment_contact_method, delivery_fee, amount, currency, payment_status, payment_reference, items, status, created_at')
        .order('created_at', { ascending: false });
      if (error) throw error;
      setOrders(data || []);
    } catch (error) {
      console.error('Could not load admin orders.', error);
      setOrdersError('Could not load orders. Check the Supabase orders table and admin access policies.');
    }
  }, []);

  const refreshCustomers = useCallback(async () => {
    setCustomersError('');
    setCustomersLoading(true);
    try {
      const { data, error } = await supabase
        .from('customer_profiles')
        .select('user_id, email, full_name, created_at, last_active_at')
        .order('created_at', { ascending: false });
      if (error) throw error;
      setCustomers(data || []);
    } catch (error) {
      console.error('Could not load admin customers.', error);
      setCustomersError('Could not load customer accounts. Apply the latest Supabase schema and check admin access policies.');
    } finally {
      setCustomersLoading(false);
    }
  }, []);

  const refreshProducts = useCallback(async () => {
    setProductsError('');
    try {
      const { data, error } = await supabase
        .from('products')
        .select('id, name, category, image, color, material, description, price, position')
        .eq('active', true)
        .order('position', { ascending: true });
      if (error) throw error;
      const catalog = data || [];
      setProducts(catalog);
      setPriceDrafts(Object.fromEntries(catalog.map((product) => [
        product.id,
        product.price === null || product.price === undefined ? '' : String(product.price),
      ])));
    } catch (error) {
      console.error('Could not load admin products.', error);
      setProductsError('Could not load products. Check the Supabase products table and admin access policies.');
    }
  }, []);

  const refreshUpcomingProducts = useCallback(async () => {
    setUpcomingProductsError('');
    try {
      const { data, error } = await supabase
        .from('upcoming_products')
        .select('id, name, category, description, image, color, material, expected_release, created_at')
        .order('created_at', { ascending: false });
      if (error) throw error;
      setUpcomingProducts(data || []);
    } catch (error) {
      console.error('Could not load upcoming products.', error);
      setUpcomingProductsError('Could not load the upcoming collection. Apply the latest Supabase schema and check admin permissions.');
    }
  }, []);

  const refreshVisitors = useCallback(async () => {
    setVisitorsError('');
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    const from = new Date(today);
    from.setUTCDate(from.getUTCDate() - 29);
    try {
      const { data, error } = await supabase
        .from('site_visit_daily_summary')
        .select('visit_date, unique_visitors')
        .gte('visit_date', from.toISOString().slice(0, 10))
        .order('visit_date', { ascending: true });
      if (error) throw error;
      const countsByDate = new Map((data || []).map((record) => [record.visit_date, Number(record.unique_visitors) || 0]));
      setVisitorDays(Array.from({ length: 30 }, (_, index) => {
        const date = new Date(today);
        date.setUTCDate(today.getUTCDate() - 29 + index);
        const key = date.toISOString().slice(0, 10);
        return { date: key, count: countsByDate.get(key) || 0 };
      }));
    } catch (error) {
      console.error('Could not load visitor analytics.', error);
      setVisitorsError('Visitor analytics are unavailable. Apply the latest Supabase schema, then refresh.');
    }
  }, []);

  const refreshDashboard = useCallback(async () => {
    setDashboardLoading(true);
    setNotice('');
    try {
      await Promise.all([refreshOrders(), refreshCustomers(), refreshProducts(), refreshUpcomingProducts(), refreshVisitors()]);
    } finally {
      setDashboardLoading(false);
    }
  }, [refreshOrders, refreshCustomers, refreshProducts, refreshUpcomingProducts, refreshVisitors]);

  useEffect(() => {
    let active = true;
    const applySession = async (session) => {
      if (!active) return;
      const user = session?.user;
      if (user?.app_metadata?.role === 'admin') {
        if (!sessionWasAuthorized.current) refreshDashboard();
        sessionWasAuthorized.current = true;
        setAuthorized(true);
        setEmail(user.email || '');
        setLoginMessage('');
      } else {
        sessionWasAuthorized.current = false;
        setAuthorized(false);
        if (user) {
          setLoginMessage('This account is not authorized to access the admin dashboard.');
          try {
            const { error } = await supabase.auth.signOut({ scope: 'local' });
            if (error) console.error('Could not sign out an unauthorized account.', error);
          } catch (error) {
            console.error('Could not sign out an unauthorized account.', error);
          }
        }
      }
      setAuthLoading(false);
    };

    supabase.auth.getSession().then(({ data, error }) => {
      if (!active) return;
      if (error) {
        console.error('Could not verify the admin session.', error);
        setLoginMessage('Could not verify your session. Please sign in again.');
        setAuthLoading(false);
        return;
      }
      applySession(data.session);
    }).catch((error) => {
      if (!active) return;
      console.error('Could not verify the admin session.', error);
      setLoginMessage('Could not verify your session. Please sign in again.');
      setAuthLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      applySession(session);
    });
    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [refreshDashboard]);

  useEffect(() => {
    if (!authorized) return undefined;
    const channel = supabase
      .channel('mavoryi-react-admin-orders')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'orders',
      }, () => {
        setNewOrderNotice('A new customer order has arrived.');
        refreshOrders();
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') setLiveStatus('Live order updates connected.');
        else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          setLiveStatus('Live updates are unavailable. Use Refresh to check for orders.');
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [authorized, refreshOrders]);

  useEffect(() => {
    if (!authorized || activeTab !== 'customers') return undefined;
    const intervalId = window.setInterval(refreshCustomers, 60 * 1000);
    return () => window.clearInterval(intervalId);
  }, [authorized, activeTab, refreshCustomers]);

  const signIn = async (event) => {
    event.preventDefault();
    setAuthBusy(true);
    setLoginMessage('Signing in…');
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      setPassword('');
      if (error || !data.user) {
        setLoginMessage('Sign-in failed. Check the email and password, then try again.');
        return;
      }
      if (data.user.app_metadata?.role !== 'admin') {
        await supabase.auth.signOut({ scope: 'local' });
        setLoginMessage('This account is not authorized to access the admin dashboard.');
        return;
      }
      if (!sessionWasAuthorized.current) {
        sessionWasAuthorized.current = true;
        await refreshDashboard();
      }
      setAuthorized(true);
      setEmail(data.user.email || email.trim());
      setLoginMessage('');
    } catch (error) {
      console.error('Could not sign in to the admin dashboard.', error);
      setLoginMessage('Could not reach the sign-in service. Check your connection and try again.');
    } finally {
      setAuthBusy(false);
    }
  };

  const signOut = async () => {
    try {
      const { error } = await supabase.auth.signOut({ scope: 'local' });
      if (error) throw error;
      sessionWasAuthorized.current = false;
      setAuthorized(false);
      setOrders([]);
      setCustomers([]);
      setProducts([]);
      setUpcomingProducts([]);
      setNotice('');
      setLoginMessage('You have signed out.');
    } catch (error) {
      console.error('Could not sign out of the admin dashboard.', error);
      setNotice('Could not sign out. Please try again.');
    }
  };

  const updateOrderStatus = async (orderId, status) => {
    setSavingOrderId(orderId);
    setNotice('');
    try {
      const { data, error } = await supabase
        .from('orders')
        .update({ status })
        .eq('id', orderId)
        .select('id, status')
        .single();
      if (error) throw error;
      setOrders((current) => current.map((order) => order.id === data.id ? { ...order, status: data.status } : order));
      setNotice('Order status updated.');
    } catch (error) {
      console.error('Could not update the order status.', error);
      setNotice('Status update failed. Check the admin update permissions and try again.');
    } finally {
      setSavingOrderId('');
    }
  };

  const savePrice = async (product) => {
    const normalized = String(priceDrafts[product.id] ?? '').trim();
    const price = normalized === '' ? null : Number(normalized);
    if (price !== null && (!Number.isFinite(price) || price <= 0)) {
      setNotice('Enter a price greater than zero, or leave it blank for “Price on request”.');
      return;
    }

    setSavingProductId(product.id);
    setNotice('');
    try {
      const { error } = await supabase
        .from('products')
        .update({ price, updated_at: new Date().toISOString() })
        .eq('id', product.id)
        .select('id')
        .single();
      if (error) throw error;
      const updatedCatalog = products.map((item) => item.id === product.id ? { ...item, price } : item);
      setProducts(updatedCatalog);
      syncLocalCatalog(updatedCatalog);
      setNotice(`Price saved for ${product.name}.`);
    } catch (error) {
      console.error('Could not update the product price.', error);
      setNotice('Could not save this price. Check the admin update permissions and try again.');
    } finally {
      setSavingProductId('');
    }
  };

  const addProduct = async (event) => {
    event.preventDefault();
    const name = productDraft.name.trim();
    const category = productDraft.category.trim();
    const id = slugifyProductName(name);
    const cleanPrice = productDraft.price.trim();
    const price = cleanPrice ? Number(cleanPrice) : null;

    if (name.length < 2 || name.length > 120 || !category || !id) {
      setNotice('Enter a product name and category. The name must be between 2 and 120 characters.');
      return;
    }
    if (cleanPrice && (!Number.isFinite(price) || price <= 0)) {
      setNotice('Enter a price greater than zero, or leave it blank for “Price on request”.');
      return;
    }

    setIsAddingProduct(true);
    setNotice('');
    try {
      const position = products.reduce((highest, product) => Math.max(highest, Number(product.position) || 0), 0) + 10;
      const { data, error } = await supabase
        .from('products')
        .insert({
          id,
          name,
          category,
          image: productDraft.image.trim() || null,
          color: productDraft.color.trim() || null,
          material: productDraft.material.trim() || null,
          description: productDraft.description.trim() || null,
          price,
          active: true,
          position,
        })
        .select('id, name, category, image, color, material, description, price, position')
        .single();
      if (error) throw error;

      const updatedCatalog = [...products, data].sort((a, b) => a.position - b.position);
      setProducts(updatedCatalog);
      setPriceDrafts((current) => ({ ...current, [data.id]: data.price == null ? '' : String(data.price) }));
      syncLocalCatalog(updatedCatalog);
      setProductDraft({ ...EMPTY_PRODUCT_DRAFT });
      setIsProductFormOpen(false);
      setNotice(`${data.name} was added to the storefront catalog.`);
    } catch (error) {
      console.error('Could not add the product.', error);
      setNotice(error.code === '23505'
        ? `A product with the ID “${id}” already exists. Change the name and try again.`
        : 'Could not add this product. Check the admin insert permissions and try again.');
    } finally {
      setIsAddingProduct(false);
    }
  };

  const editProduct = (product) => {
    setEditingProductId(product.id);
    setProductEditDraft({
      name: product.name || '',
      category: product.category || '',
      image: product.image || '',
      color: product.color || '',
      material: product.material || '',
      description: product.description || '',
      price: product.price == null ? '' : String(product.price),
    });
  };

  const saveProductDetails = async (event, product) => {
    event.preventDefault();
    const name = productEditDraft.name.trim();
    const category = productEditDraft.category.trim();
    const description = productEditDraft.description.trim();
    if (name.length < 2 || name.length > 120 || !category || description.length > 1000) {
      setNotice('Enter a product name, category, and description no longer than 1,000 characters.');
      return;
    }

    setIsSavingProductDetails(true);
    setNotice('');
    try {
      const { data, error } = await supabase
        .from('products')
        .update({
          name,
          category,
          image: productEditDraft.image.trim() || null,
          color: productEditDraft.color.trim() || null,
          material: productEditDraft.material.trim() || null,
          description: description || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', product.id)
        .select('id, name, category, image, color, material, description, price, position')
        .single();
      if (error) throw error;

      const updatedCatalog = products.map((item) => item.id === data.id ? data : item);
      setProducts(updatedCatalog);
      syncLocalCatalog(updatedCatalog);
      setEditingProductId('');
      setProductEditDraft({ ...EMPTY_PRODUCT_DRAFT });
      setNotice(`${data.name} details were updated.`);
    } catch (error) {
      console.error('Could not update product details.', error);
      setNotice('Could not save product details. Apply the latest Supabase schema and check admin permissions.');
    } finally {
      setIsSavingProductDetails(false);
    }
  };

  const saveUpcomingProduct = async (event) => {
    event.preventDefault();
    const name = upcomingDraft.name.trim();
    const category = upcomingDraft.category.trim();
    const description = upcomingDraft.description.trim();
    if (name.length < 2 || !category || description.length < 2) {
      setNotice('Enter a product name, category, and short description for the upcoming collection.');
      return;
    }

    const product = {
      name,
      category,
      description,
      image: upcomingDraft.image.trim() || null,
      color: upcomingDraft.color.trim() || null,
      material: upcomingDraft.material.trim() || null,
      expected_release: upcomingDraft.expected_release.trim() || null,
    };

    setIsSavingUpcoming(true);
    setNotice('');
    try {
      const query = editingUpcomingId
        ? supabase.from('upcoming_products').update(product).eq('id', editingUpcomingId)
        : supabase.from('upcoming_products').insert(product);
      const { data, error } = await query
        .select('id, name, category, description, image, color, material, expected_release, created_at')
        .single();
      if (error) throw error;

      setUpcomingProducts((current) => editingUpcomingId
        ? current.map((item) => item.id === data.id ? data : item)
        : [data, ...current]);
      setUpcomingDraft({ ...EMPTY_UPCOMING_DRAFT });
      setEditingUpcomingId('');
      setNotice(`${data.name} was ${editingUpcomingId ? 'updated' : 'added'} to the upcoming collection.`);
    } catch (error) {
      console.error('Could not save an upcoming product.', error);
      setNotice('Could not save this collection item. Apply the latest Supabase schema and check admin permissions.');
    } finally {
      setIsSavingUpcoming(false);
    }
  };

  const editUpcomingProduct = (product) => {
    setUpcomingDraft({
      name: product.name || '',
      category: product.category || '',
      description: product.description || '',
      image: product.image || '',
      color: product.color || '',
      material: product.material || '',
      expected_release: product.expected_release || '',
    });
    setEditingUpcomingId(product.id);
  };

  const deleteUpcomingProduct = async (product) => {
    if (!window.confirm(`Remove ${product.name} from the upcoming collection?`)) return;
    setNotice('');
    try {
      const { error } = await supabase.from('upcoming_products').delete().eq('id', product.id);
      if (error) throw error;
      setUpcomingProducts((current) => current.filter((item) => item.id !== product.id));
      setNotice(`${product.name} was removed from the upcoming collection.`);
    } catch (error) {
      console.error('Could not remove an upcoming product.', error);
      setNotice('Could not remove this collection item. Check the admin delete permission and try again.');
    }
  };

  const filteredOrders = useMemo(() => {
    const query = search.trim().toLowerCase();
    return orders.filter((order) => {
      const matchesStatus = statusFilter === 'all' || order.status === statusFilter;
      const matchesSearch = !query || [
        order.customer_name,
        order.customer_phone,
        order.customer_email,
        order.id,
      ].some((value) => String(value || '').toLowerCase().includes(query));
      return matchesStatus && matchesSearch;
    });
  }, [orders, search, statusFilter]);

  const filteredCustomers = useMemo(() => {
    const query = customerSearch.trim().toLowerCase();
    return customers.filter((customer) => {
      const active = isCustomerActive(customer);
      const newCustomer = isNewCustomer(customer);
      const matchesFilter = customerFilter === 'all'
        || (customerFilter === 'active' && active)
        || (customerFilter === 'new' && newCustomer)
        || (customerFilter === 'established' && !newCustomer);
      const matchesSearch = !query || [
        customer.full_name,
        customer.email,
      ].some((value) => String(value || '').toLowerCase().includes(query));
      return matchesFilter && matchesSearch;
    });
  }, [customers, customerFilter, customerSearch]);

  const newOrdersCount = orders.filter((order) => order.status === 'new').length;
  const inProgressCount = orders.filter((order) => ['confirmed', 'preparing', 'out_for_delivery'].includes(order.status)).length;
  const ordersValue = orders.reduce((total, order) => total + (Number(order.amount) || 0), 0);
  const totalVisitorsInRange = visitorDays.reduce((total, day) => total + day.count, 0);
  const todayVisitors = visitorDays[visitorDays.length - 1]?.count || 0;
  const activeCustomersCount = customers.filter((customer) => isCustomerActive(customer)).length;
  const newCustomersCount = customers.filter((customer) => isNewCustomer(customer)).length;
  const establishedCustomersCount = customers.length - newCustomersCount;

  if (authLoading) {
    return <main className="admin-portal"><div className="admin-loading" role="status">Checking admin access…</div></main>;
  }

  if (!authorized) {
    return (
      <main className="admin-portal">
        <header className="admin-topbar">
          <a className="store-brand" href="/" aria-label="MAVORYI home"><span>MAVORYI</span><small>ORDER MANAGEMENT</small></a>
          <a className="admin-store-link" href="/">Back to storefront <span aria-hidden="true">↗</span></a>
        </header>
        <form className="admin-auth-form" onSubmit={signIn}>
          <p className="admin-eyebrow">PRIVATE AREA</p>
          <h1>Admin sign in</h1>
          <p className="admin-login-intro">Sign in with your authorized MAVORYI admin account to manage customer accounts, orders, products, and the upcoming collection.</p>
          <label>Email<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="username" required /></label>
          <label>Password<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" required /></label>
          <button className="admin-primary-button" type="submit" disabled={authBusy}>{authBusy ? 'Signing in…' : 'Sign in'}</button>
          {loginMessage && <p className="admin-feedback" role="status">{loginMessage}</p>}
        </form>
      </main>
    );
  }

  return (
    <main className="admin-portal">
      <header className="admin-topbar">
        <a className="store-brand" href="/" aria-label="MAVORYI home"><span>MAVORYI</span><small>ORDER MANAGEMENT</small></a>
        <div className="admin-account">
          <span title={email}>{email}</span>
          <button className="admin-secondary-button" type="button" onClick={signOut}>Sign out</button>
        </div>
      </header>

      <div className="admin-workspace">
        <section className="admin-welcome">
          <div>
            <p className="admin-eyebrow">MAVORYI OPERATIONS</p>
            <h1>Admin dashboard</h1>
            <p>Manage customer accounts, orders, storefront products, and upcoming collections.</p>
          </div>
          <button className="admin-secondary-button" type="button" onClick={refreshDashboard} disabled={dashboardLoading}>
            {dashboardLoading ? 'Refreshing…' : '↻ Refresh'}
          </button>
        </section>

        <div className="admin-live-line">
          <span className="admin-live-dot" aria-hidden="true" />
          <span>{liveStatus}</span>
        </div>

        {newOrderNotice && (
          <div className="admin-new-order" role="status" aria-live="polite">
            <span>{newOrderNotice}</span>
            <button type="button" onClick={() => setNewOrderNotice('')}>Dismiss</button>
          </div>
        )}
        {notice && <p className="admin-feedback" role="status" aria-live="polite">{notice}</p>}

        <nav className="admin-tabs" aria-label="Admin sections">
          {[
            ['overview', 'Overview'],
            ['orders', `Orders${newOrdersCount ? ` (${newOrdersCount})` : ''}`],
            ['customers', `Customers${customers.length ? ` (${customers.length})` : ''}`],
            ['products', 'Products & prices'],
            ['upcoming', 'Upcoming collection'],
          ].map(([tab, label]) => (
            <button
              type="button"
              className={activeTab === tab ? 'active' : ''}
              aria-current={activeTab === tab ? 'page' : undefined}
              key={tab}
              onClick={() => {
                setActiveTab(tab);
                if (tab === 'customers') refreshCustomers();
              }}
            >{label}</button>
          ))}
        </nav>

        {activeTab === 'overview' && (
          <section aria-labelledby="overview-heading">
            <div className="admin-section-heading">
              <div><p className="admin-eyebrow">TODAY AT A GLANCE</p><h2 id="overview-heading">Store overview</h2></div>
              <p>{orders.length} total order{orders.length === 1 ? '' : 's'}</p>
            </div>
            <div className="admin-stats-grid">
              <article className="admin-stat-card"><span>Needs attention</span><strong>{newOrdersCount}</strong><small>New orders to review</small></article>
              <article className="admin-stat-card"><span>In progress</span><strong>{inProgressCount}</strong><small>Confirmed through delivery</small></article>
              <article className="admin-stat-card"><span>Order value</span><strong>{formatMoney(ordersValue)}</strong><small>Across orders with recorded totals</small></article>
              <article className="admin-stat-card"><span>Visitors today</span><strong>{todayVisitors}</strong><small>Unique browsers, UTC</small></article>
            </div>
            {ordersError && <p className="admin-feedback" role="status">{ordersError}</p>}
            <section className="admin-visitor-panel" aria-labelledby="visitors-heading">
              <div className="admin-section-heading">
                <div><p className="admin-eyebrow">AUDIENCE</p><h2 id="visitors-heading">Daily visitors</h2></div>
                <p>{totalVisitorsInRange} unique browser-days · past 30 days</p>
              </div>
              <p className="admin-catalog-hint">Approximate unique browsers per day. The chart does not identify individual people.</p>
              {visitorsError
                ? <p className="admin-feedback" role="status">{visitorsError}</p>
                : <VisitorChart days={visitorDays} />}
            </section>
            <div className="admin-section-heading admin-recent-heading">
              <div><p className="admin-eyebrow">LATEST ACTIVITY</p><h2>Recent orders</h2></div>
              <button className="admin-text-button" type="button" onClick={() => setActiveTab('orders')}>View all orders ↗</button>
            </div>
            {orders.length ? (
              <div className="admin-order-list">
                {orders.slice(0, 3).map((order) => (
                  <OrderCard key={`${order.id}-${order.status}`} order={order} onUpdateStatus={updateOrderStatus} saving={savingOrderId === order.id} />
                ))}
              </div>
            ) : !ordersError ? <p className="admin-empty">No customer orders yet. New orders will appear here.</p> : null}
          </section>
        )}

        {activeTab === 'orders' && (
          <section aria-labelledby="orders-heading">
            <div className="admin-section-heading">
              <div><p className="admin-eyebrow">ORDER MANAGEMENT</p><h2 id="orders-heading">Customer orders</h2></div>
              <p>{filteredOrders.length} shown</p>
            </div>
            <div className="admin-order-filters">
              <label className="admin-search-label">
                <span className="sr-only">Search orders</span>
                <input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search name, phone, email or reference" />
              </label>
              <label>
                <span className="sr-only">Filter by status</span>
                <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
                  <option value="all">All statuses</option>
                  {ORDER_STATUSES.map(([value, label]) => <option value={value} key={value}>{label}</option>)}
                </select>
              </label>
            </div>
            {ordersError && <p className="admin-feedback" role="status">{ordersError}</p>}
            {filteredOrders.length ? (
              <div className="admin-order-list">
                {filteredOrders.map((order) => (
                  <OrderCard key={`${order.id}-${order.status}`} order={order} onUpdateStatus={updateOrderStatus} saving={savingOrderId === order.id} />
                ))}
              </div>
            ) : !ordersError ? (
              <p className="admin-empty">{orders.length ? 'No orders match your search and status filter.' : 'No customer orders yet.'}</p>
            ) : null}
          </section>
        )}

        {activeTab === 'customers' && (
          <section aria-labelledby="customers-heading">
            <div className="admin-section-heading">
              <div><p className="admin-eyebrow">CUSTOMER DATABASE</p><h2 id="customers-heading">Customer accounts</h2></div>
              <button className="admin-secondary-button" type="button" onClick={refreshCustomers} disabled={customersLoading}>
                {customersLoading ? 'Refreshing…' : '↻ Refresh customers'}
              </button>
            </div>
            <p className="admin-catalog-hint">Active means signed in with the storefront open within the last 30 minutes. New accounts joined in the last 30 days; older accounts are established.</p>
            <div className="admin-stats-grid">
              <article className="admin-stat-card"><span>Active users</span><strong>{activeCustomersCount}</strong><small>Activity in the past 30 minutes</small></article>
              <article className="admin-stat-card"><span>New users</span><strong>{newCustomersCount}</strong><small>Joined in the past 30 days</small></article>
              <article className="admin-stat-card"><span>Established users</span><strong>{establishedCustomersCount}</strong><small>Joined more than 30 days ago</small></article>
              <article className="admin-stat-card"><span>Total accounts</span><strong>{customers.length}</strong><small>Registered accounts</small></article>
            </div>
            {customersError && <p className="admin-feedback" role="status">{customersError}</p>}
            <div className="admin-order-filters">
              <label className="admin-search-label">
                <span className="sr-only">Search customers</span>
                <input type="search" value={customerSearch} onChange={(event) => setCustomerSearch(event.target.value)} placeholder="Search name or email" />
              </label>
              <label>
                <span className="sr-only">Filter customers</span>
                <select value={customerFilter} onChange={(event) => setCustomerFilter(event.target.value)}>
                  <option value="all">All accounts</option>
                  <option value="active">Active in last 30 minutes</option>
                  <option value="new">New in last 30 days</option>
                  <option value="established">Established accounts</option>
                </select>
              </label>
            </div>
            {filteredCustomers.length ? (
              <div className="admin-customer-list">
                {filteredCustomers.map((customer) => {
                  const active = isCustomerActive(customer);
                  const newCustomer = isNewCustomer(customer);
                  return (
                    <article className="admin-customer-card" key={customer.user_id}>
                      <div className="admin-customer-identity">
                        <h3>{customer.full_name || 'MAVORYI member'}</h3>
                        {customer.email
                          ? <a href={`mailto:${customer.email}`}>{customer.email}</a>
                          : <span>Email unavailable</span>}
                      </div>
                      <div className="admin-customer-meta">
                        <span className={`admin-customer-badge${active ? ' is-active' : ''}`}>{active ? 'Active' : 'Inactive'}</span>
                        <span className={`admin-customer-badge${newCustomer ? ' is-new' : ''}`}>{newCustomer ? 'New' : 'Established'}</span>
                        <div><span className="admin-detail-label">Joined</span><time dateTime={customer.created_at}>{formatDate(customer.created_at)}</time></div>
                        <div><span className="admin-detail-label">Last active</span><time dateTime={customer.last_active_at || undefined}>{customer.last_active_at ? formatDate(customer.last_active_at) : 'Not recorded yet'}</time></div>
                      </div>
                    </article>
                  );
                })}
              </div>
            ) : !customersError ? (
              <p className="admin-empty">
                {customersLoading
                  ? 'Loading customer accounts…'
                  : customers.length
                    ? 'No accounts match your search and filter.'
                    : 'No customer accounts have signed up yet.'}
              </p>
            ) : null}
          </section>
        )}

        {activeTab === 'products' && (
          <section aria-labelledby="products-heading">
            <div className="admin-section-heading">
              <div><p className="admin-eyebrow">STOREFRONT CATALOG</p><h2 id="products-heading">Manage products</h2></div>
              <button
                className="admin-primary-button"
                type="button"
                onClick={() => setIsProductFormOpen((isOpen) => !isOpen)}
              >{isProductFormOpen ? 'Close form' : '+ Add product'}</button>
            </div>
            <p className="admin-catalog-hint">Update product images, descriptions, details, and prices. Leave a price blank to show “Price on request”.</p>
            {productsError && <p className="admin-feedback" role="status">{productsError}</p>}
            {isProductFormOpen && (
              <form className="admin-new-product-form" onSubmit={addProduct}>
                <div className="admin-new-product-heading">
                  <div><p className="admin-eyebrow">NEW CATALOG ITEM</p><h3>Add a product</h3></div>
                  <p>Product ID: <code>{slugifyProductName(productDraft.name) || 'generated-from-name'}</code></p>
                </div>
                <div className="admin-new-product-fields">
                  <label>Product name<input value={productDraft.name} onChange={(event) => setProductDraft((current) => ({ ...current, name: event.target.value }))} maxLength={120} required /></label>
                  <label>Category<input value={productDraft.category} onChange={(event) => setProductDraft((current) => ({ ...current, category: event.target.value }))} maxLength={80} placeholder="Travel bag, Helmet…" required /></label>
                  <label>Image URL or filename<input value={productDraft.image} onChange={(event) => setProductDraft((current) => ({ ...current, image: event.target.value }))} maxLength={1000} placeholder="product.jpeg or https://…" /></label>
                  <label>Color<input value={productDraft.color} onChange={(event) => setProductDraft((current) => ({ ...current, color: event.target.value }))} maxLength={80} placeholder="Optional" /></label>
                  <label>Material<input value={productDraft.material} onChange={(event) => setProductDraft((current) => ({ ...current, material: event.target.value }))} maxLength={120} placeholder="Optional" /></label>
                  <label>Price (GHS)<input type="number" min="0.01" step="0.01" inputMode="decimal" value={productDraft.price} onChange={(event) => setProductDraft((current) => ({ ...current, price: event.target.value }))} placeholder="Leave blank for price on request" /></label>
                  <label className="admin-full-width">Product description<textarea value={productDraft.description} onChange={(event) => setProductDraft((current) => ({ ...current, description: event.target.value }))} maxLength={1000} rows={3} /></label>
                </div>
                <p className="admin-image-help">For a filename, place the image in <code>frontend-react/public/images</code> before deploying.</p>
                <div className="admin-new-product-actions">
                  <button className="admin-primary-button" type="submit" disabled={isAddingProduct}>{isAddingProduct ? 'Adding…' : 'Add to storefront'}</button>
                  <button className="admin-secondary-button" type="button" onClick={() => {
                    setIsProductFormOpen(false);
                    setProductDraft({ ...EMPTY_PRODUCT_DRAFT });
                  }}>Cancel</button>
                </div>
              </form>
            )}
            {products.length ? (
              <div className="admin-product-list">
                {products.map((product) => (
                  <article className="admin-product-entry" key={product.id}>
                    <form className="admin-product-row" onSubmit={(event) => {
                      event.preventDefault();
                      savePrice(product);
                    }}>
                      <div className="admin-product-identity">
                        {product.image && <img src={resolveProductImage(product.image)} alt="" loading="lazy" />}
                        <div><strong>{product.name}</strong><span>{product.category}</span></div>
                      </div>
                      <label>
                        <span>GHS</span>
                        <input
                          type="number"
                          min="0.01"
                          step="0.01"
                          inputMode="decimal"
                          value={priceDrafts[product.id] ?? ''}
                          onChange={(event) => setPriceDrafts((current) => ({ ...current, [product.id]: event.target.value }))}
                          aria-label={`Price for ${product.name} in GHS`}
                        />
                      </label>
                      <button className="admin-primary-button" type="submit" disabled={savingProductId === product.id}>
                        {savingProductId === product.id ? 'Saving…' : 'Save price'}
                      </button>
                      <button
                        className="admin-secondary-button"
                        type="button"
                        aria-expanded={editingProductId === product.id}
                        onClick={() => editingProductId === product.id
                          ? setEditingProductId('')
                          : editProduct(product)}
                      >{editingProductId === product.id ? 'Close details' : 'Edit details'}</button>
                    </form>
                    {editingProductId === product.id && (
                      <form className="admin-product-details-form" onSubmit={(event) => saveProductDetails(event, product)}>
                        <div className="admin-new-product-fields">
                          <label>Product name<input value={productEditDraft.name} onChange={(event) => setProductEditDraft((current) => ({ ...current, name: event.target.value }))} maxLength={120} required /></label>
                          <label>Category<input value={productEditDraft.category} onChange={(event) => setProductEditDraft((current) => ({ ...current, category: event.target.value }))} maxLength={80} required /></label>
                          <label>Image URL or filename<input value={productEditDraft.image} onChange={(event) => setProductEditDraft((current) => ({ ...current, image: event.target.value }))} maxLength={1000} placeholder="product.jpeg or https://…" /></label>
                          <label>Color<input value={productEditDraft.color} onChange={(event) => setProductEditDraft((current) => ({ ...current, color: event.target.value }))} maxLength={80} /></label>
                          <label>Material<input value={productEditDraft.material} onChange={(event) => setProductEditDraft((current) => ({ ...current, material: event.target.value }))} maxLength={120} /></label>
                          <label className="admin-full-width">Product description<textarea value={productEditDraft.description} onChange={(event) => setProductEditDraft((current) => ({ ...current, description: event.target.value }))} maxLength={1000} rows={3} /></label>
                        </div>
                        {product.id === 'nimbus' && <p className="admin-image-help">For NIMBUS, the image applies to the selected colour. Its other colour images remain unchanged.</p>}
                        <div className="admin-new-product-actions">
                          <button className="admin-primary-button" type="submit" disabled={isSavingProductDetails}>{isSavingProductDetails ? 'Saving…' : 'Save product details'}</button>
                          <button className="admin-secondary-button" type="button" onClick={() => setEditingProductId('')}>Cancel</button>
                        </div>
                      </form>
                    )}
                  </article>
                ))}
              </div>
            ) : !productsError ? <p className="admin-empty">No active products found.</p> : null}
          </section>
        )}

        {activeTab === 'upcoming' && (
          <section aria-labelledby="upcoming-heading">
            <div className="admin-section-heading">
              <div><p className="admin-eyebrow">MEMBER-ONLY PREVIEW</p><h2 id="upcoming-heading">Upcoming collection</h2></div>
              <button
                className="admin-primary-button"
                type="button"
                onClick={() => {
                  setEditingUpcomingId('');
                  setUpcomingDraft({ ...EMPTY_UPCOMING_DRAFT });
                }}
              >+ Add upcoming product</button>
            </div>
            <p className="admin-catalog-hint">Only signed-in members can view these previews. Add a hosted image URL or a filename in <code>frontend-react/public/images</code>.</p>
            {upcomingProductsError && <p className="admin-feedback" role="status">{upcomingProductsError}</p>}
            <form className="admin-new-product-form" onSubmit={saveUpcomingProduct}>
              <div className="admin-new-product-heading">
                <div><p className="admin-eyebrow">{editingUpcomingId ? 'EDIT PREVIEW' : 'NEW PREVIEW'}</p><h3>{editingUpcomingId ? 'Edit upcoming product' : 'Add to the upcoming collection'}</h3></div>
              </div>
              <div className="admin-new-product-fields">
                <label>Product name<input value={upcomingDraft.name} onChange={(event) => setUpcomingDraft((current) => ({ ...current, name: event.target.value }))} maxLength={120} required /></label>
                <label>Category<input value={upcomingDraft.category} onChange={(event) => setUpcomingDraft((current) => ({ ...current, category: event.target.value }))} maxLength={80} required /></label>
                <label>Image URL or filename<input value={upcomingDraft.image} onChange={(event) => setUpcomingDraft((current) => ({ ...current, image: event.target.value }))} maxLength={1000} placeholder="product.jpeg or https://…" /></label>
                <label>Expected availability<input value={upcomingDraft.expected_release} onChange={(event) => setUpcomingDraft((current) => ({ ...current, expected_release: event.target.value }))} maxLength={80} placeholder="For example, Early 2027" /></label>
                <label>Colour<input value={upcomingDraft.color} onChange={(event) => setUpcomingDraft((current) => ({ ...current, color: event.target.value }))} maxLength={80} /></label>
                <label>Material<input value={upcomingDraft.material} onChange={(event) => setUpcomingDraft((current) => ({ ...current, material: event.target.value }))} maxLength={120} /></label>
                <label className="admin-full-width">Short description<textarea value={upcomingDraft.description} onChange={(event) => setUpcomingDraft((current) => ({ ...current, description: event.target.value }))} maxLength={1000} rows={4} required /></label>
              </div>
              <div className="admin-new-product-actions">
                <button className="admin-primary-button" type="submit" disabled={isSavingUpcoming}>{isSavingUpcoming ? 'Saving…' : editingUpcomingId ? 'Save changes' : 'Publish preview'}</button>
                {editingUpcomingId && <button className="admin-secondary-button" type="button" onClick={() => {
                  setEditingUpcomingId('');
                  setUpcomingDraft({ ...EMPTY_UPCOMING_DRAFT });
                }}>Cancel edit</button>}
              </div>
            </form>
            {upcomingProducts.length ? (
              <div className="admin-upcoming-list">
                {upcomingProducts.map((product) => (
                  <article className="admin-upcoming-row" key={product.id}>
                    <div className="admin-product-identity">
                      {product.image && <img src={resolveProductImage(product.image)} alt="" loading="lazy" />}
                      <div><strong>{product.name}</strong><span>{product.category}{product.expected_release ? ` · ${product.expected_release}` : ''}</span></div>
                    </div>
                    <p>{product.description}</p>
                    <div className="admin-upcoming-actions">
                      <button className="admin-secondary-button" type="button" onClick={() => editUpcomingProduct(product)}>Edit</button>
                      <button className="admin-secondary-button" type="button" onClick={() => deleteUpcomingProduct(product)}>Remove</button>
                    </div>
                  </article>
                ))}
              </div>
            ) : !upcomingProductsError ? <p className="admin-empty">No upcoming products posted yet.</p> : null}
          </section>
        )}
      </div>
    </main>
  );
}

export default AdminPortal;
