import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { CartProvider } from './context/CartContext.jsx';
import { AuthProvider } from './context/AuthContext.jsx';
import Spinner from './components/Spinner.jsx';

const Landing = lazy(() => import('./pages/Landing.jsx'));
const Restaurant = lazy(() => import('./pages/Restaurant.jsx'));
const Checkout = lazy(() => import('./pages/Checkout.jsx'));
const OrderSuccess = lazy(() => import('./pages/OrderSuccess.jsx'));
const TrackOrder = lazy(() => import('./pages/TrackOrder.jsx'));
const MyOrders = lazy(() => import('./pages/MyOrders.jsx'));

// Note: customer sign-in (/login, /account) is intentionally not routed —
// phone-OTP auth isn't configured yet. Customers order as guests; the pages
// still exist under src/pages for when OTP is enabled.
//
// /orders is the guest-friendly stand-in for /account: it lists orders placed
// on this device from localStorage, so a customer who closes the tab after
// checkout can still find and track what they ordered.

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <CartProvider>
          <Suspense fallback={<Spinner full />}>
            <Routes>
              <Route path="/" element={<Landing />} />
              <Route path="/r/:slug" element={<Restaurant />} />
              <Route path="/r/:slug/checkout" element={<Checkout />} />
              <Route path="/r/:slug/success/:orderId" element={<OrderSuccess />} />
              <Route path="/order/:orderId" element={<TrackOrder />} />
              <Route path="/orders" element={<MyOrders />} />
              <Route path="*" element={<Landing />} />
            </Routes>
          </Suspense>
        </CartProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
