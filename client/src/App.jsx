import { Routes, Route } from 'react-router-dom'
import PublicLayout from './layouts/PublicLayout'
import WorkspaceLayout from './layouts/WorkspaceLayout'
import RequireRole from './components/RequireRole'
import { ROLES } from './constants'
import Home from './pages/public/Home'
import Services from './pages/public/Services'
import Shop from './pages/public/Shop'
import ProductDetail from './pages/public/ProductDetail'
import Branches from './pages/public/Branches'
import NotFound from './pages/public/NotFound'
import Login from './pages/auth/Login'
import Register from './pages/auth/Register'
import StaffLogin from './pages/auth/StaffLogin'
import Dashboard from './pages/Dashboard'
import Profile from './pages/Profile'
import Contact from './pages/public/Contact'
import StaticPage from './pages/public/StaticPage'
import BookRepair from './pages/customer/BookRepair'
import RepairList from './pages/RepairList'
import RepairDetail from './pages/RepairDetail'
import Cart from './pages/public/Cart'
import Checkout from './pages/public/Checkout'
import OrderConfirmation from './pages/public/OrderConfirmation'
import OrderList from './pages/OrderList'
import OrderDetail from './pages/OrderDetail'
import SellDevice from './pages/customer/SellDevice'
import TradeInList from './pages/TradeInList'
import TradeInDetail from './pages/TradeInDetail'
import Loyalty from './pages/customer/Loyalty'
import Me from './pages/customer/Me'
import CounterLoyalty from './pages/staff/CounterLoyalty'
import LoyaltyAdjust from './pages/admin/LoyaltyAdjust'
import Stock from './pages/Stock'
import Deliveries from './pages/Deliveries'
import Margins from './pages/Margins'
import Hours from './pages/Hours'
import Reports from './pages/Reports'
import Till from './pages/till/Till'
import VapeShop from './pages/vapes/VapeShop'
import VapeProduct from './pages/vapes/VapeProduct'
import VapeBasket from './pages/vapes/VapeBasket'
import VapeOrders from './pages/vapes/VapeOrders'
import VapeOrderDetail from './pages/vapes/VapeOrderDetail'
import VapeDashboard from './pages/vapes/VapeDashboard'
import VapeStock from './pages/vapes/VapeStock'
import VapeDeliveries from './pages/vapes/VapeDeliveries'
import VapeMargins from './pages/vapes/VapeMargins'
import * as vapeCfg from './pages/vapes/vapeConfig'
import CrudPage from './pages/admin/CrudPage'
import * as catalogue from './pages/admin/catalogueConfig'
import * as userPages from './pages/admin/usersConfig'

// Same repair pages for every role; the server scopes what each one receives.
const repairRoutes = [
  <Route key="rl" path="repairs" element={<RepairList />} />,
  <Route key="rd" path="repairs/:ref" element={<RepairDetail />} />,
]

// One workspace per role: same layout, different guard and prefix.
const orderRoutes = [
  <Route key="ol" path="orders" element={<OrderList />} />,
  <Route key="od" path="orders/:ref" element={<OrderDetail />} />,
]

const tradeInRoutes = [
  <Route key="tl" path="tradeins" element={<TradeInList />} />,
  <Route key="td" path="tradeins/:ref" element={<TradeInDetail />} />,
]

// The vape range has its own pages in every workspace: separate stock, deliveries, orders and profit.
const vapeStaffRoutes = [
  <Route key="vd" path="vapes" element={<VapeDashboard />} />,
  <Route key="vo" path="vapes/orders" element={<VapeOrders />} />,
  <Route key="vod" path="vapes/orders/:ref" element={<VapeOrderDetail />} />,
  <Route key="vs" path="vapes/stock" element={<VapeStock />} />,
  <Route key="vdel" path="vapes/deliveries" element={<VapeDeliveries />} />,
]

const workspace = (path, role, children) => (
  <Route path={path} element={<RequireRole role={role} />}>
    <Route element={<WorkspaceLayout />}>
      <Route index element={<Dashboard />} />
      <Route path="profile" element={<Profile />} />
      {children}
    </Route>
  </Route>
)

export default function App() {
  return (
    <Routes>
      <Route element={<PublicLayout />}>
        <Route index element={<Home />} />
        <Route path="services" element={<Services />} />
        <Route path="shop" element={<Shop />} />
        <Route path="shop/:id" element={<ProductDetail />} />
        <Route path="vapes" element={<VapeShop />} />
        <Route path="vapes/basket" element={<VapeBasket />} />
        <Route path="vapes/:id" element={<VapeProduct />} />
        <Route path="branches" element={<Branches />} />
        <Route path="contact" element={<Contact />} />
        <Route path="terms" element={<StaticPage slug="terms" />} />
        <Route path="privacy" element={<StaticPage slug="privacy" />} />
        <Route path="warranty" element={<StaticPage slug="warranty" />} />
        <Route path="cart" element={<Cart />} />
        <Route path="checkout" element={<Checkout />} />
        <Route path="order-confirmation/:ref" element={<OrderConfirmation />} />
        <Route path="login" element={<Login />} />
        <Route path="register" element={<Register />} />
        <Route path="staff-login" element={<StaffLogin />} />
        <Route path="*" element={<NotFound />} />
      </Route>
      {/* The till is full screen (no sidebar) and has its own PIN sign-in, apart from the dashboards; the server enforces it. */}
      <Route path="/till" element={<Till />} />
      {workspace('/app', ROLES.CUSTOMER, [<Route key="book" path="book" element={<BookRepair />} />, <Route key="sell" path="sell" element={<SellDevice />} />, <Route key="loy" path="loyalty" element={<Loyalty />} />, <Route key="me" path="me" element={<Me />} />, <Route key="vol" path="vape-orders" element={<VapeOrders />} />, <Route key="vod" path="vape-orders/:ref" element={<VapeOrderDetail />} />, ...repairRoutes, ...orderRoutes, ...tradeInRoutes])}
      {workspace('/staff', ROLES.STAFF, [...repairRoutes, ...orderRoutes, ...tradeInRoutes, ...vapeStaffRoutes, <Route key="stock" path="stock" element={<Stock />} />, <Route key="del" path="deliveries" element={<Deliveries />} />, <Route key="hours" path="hours" element={<Hours />} />, <Route key="loy" path="loyalty" element={<CounterLoyalty />} />])}
      {workspace('/admin', ROLES.ADMIN, [
        ...repairRoutes,
        ...orderRoutes,
        ...tradeInRoutes,
        ...vapeStaffRoutes,
        <Route key="vp" path="vapes/profit" element={<VapeMargins />} />,
        <Route key="vprod" path="vapes/products" element={<CrudPage key="vprod" {...vapeCfg.products} />} />,
        <Route key="vbrand" path="vapes/brands" element={<CrudPage key="vbrand" {...vapeCfg.brands} />} />,
        <Route key="loy" path="loyalty" element={<LoyaltyAdjust />} />,
        <Route key="stock" path="stock" element={<Stock />} />,
        <Route key="del" path="deliveries" element={<Deliveries />} />,
        <Route key="profit" path="profit" element={<Margins />} />,
        <Route key="rep" path="reports/:branchId?" element={<Reports />} />, // one page, so a chosen date range survives clicking into a branch
        <Route key="hours" path="hours" element={<Hours />} />,
        ...Object.entries({ ...catalogue, ...userPages }).map(([path, cfg]) => <Route key={path} path={path} element={<CrudPage key={path} {...cfg} />} />),
      ])}
    </Routes>
  )
}
