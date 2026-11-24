"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import {
  completeOrder,
  fetchMyOrders,
  fetchNotifications,
  markAllNotificationsRead as apiMarkAllRead,
  markNotificationRead as apiMarkRead,
} from "@/lib/api";
import { Card, CardBody } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { StarRating } from "@/components/ui/StarRating";
import { RateOrderModal } from "./RateOrderModal";
import { OrderHandoff } from "./OrderHandoff";
import { OrderChat } from "./OrderChat";
import { PlaceholderImage } from "@/components/listings/PlaceholderImage";
import { formatCurrency, formatDate, formatRelativeTime } from "@/lib/format";
import { notificationText } from "@/lib/notification-text";
import type { Notification, NotificationType, Order, OrderStatus } from "@/types";
import {
  Bell,
  CalendarCheck,
  CalendarClock,
  CheckCheck,
  CircleCheck,
  Gavel,
  Handshake,
  MapPin,
  MessageSquare,
  PackageCheck,
  Star,
  Tag,
  Wallet,
  CircleX,
  ShieldCheck,
  ShieldQuestionMark,
  ShieldX,
  MessageCircle,
} from "lucide-react";
import { formatAddress } from "@/components/account/DeliveryAddressFields";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useI18n } from "@/i18n/I18nProvider";
import { errorMessage } from "@/lib/error-message";

const statusTone: Record<OrderStatus, "success" | "info" | "neutral" | "danger"> = {
  pending_pickup: "info",
  ready_for_pickup: "info",
  shipped: "info",
  completed: "success",
  cancelled: "danger",
};

const notificationIcon: Record<NotificationType, React.ComponentType<{ size?: number; className?: string }>> = {
  new_bid: Gavel,
  sold: Tag,
  message: MessageSquare,
  outbid: Gavel,
  listing_ending: Bell,
  order_completed: CircleCheck,
  meetup_proposed: CalendarClock,
  meetup_confirmed: CalendarCheck,
  delivery_confirmed: Handshake,
  payment_released: Wallet,
  order_cancelled: CircleX,
  residency_submitted: ShieldQuestionMark,
  residency_approved: ShieldCheck,
  residency_rejected: ShieldX,
};

const openStatuses: OrderStatus[] = ["pending_pickup", "ready_for_pickup", "shipped"];

// What other sellers said about this buyer, so the seller can decide whether
// to go ahead with the handoff.
function BuyerReputation({ order }: { order: Order }) {
  const { t } = useI18n();
  return (
    <p className="mt-0.5 flex items-center gap-1.5 text-xs text-ink-400" aria-label={t.orders.buyerReputation}>
      <StarRating value={order.buyerRating ?? 0} size={12} />
      {order.buyerReviewCount ? (
        <>
          <span className="font-semibold text-ink">{order.buyerRating!.toFixed(1)}</span>
          <span>{t.detail.ratingCount(order.buyerReviewCount)}</span>
        </>
      ) : (
        <span>{t.detail.noRatings}</span>
      )}
    </p>
  );
}

function OrderRow({
  order,
  role,
  onUpdated,
  chatRequested = false,
  rateRequested = false,
}: {
  order: Order;
  role: "buyer" | "seller";
  onUpdated: (order: Order) => void;
  // A notification link asked to open this order's chat or rating form.
  chatRequested?: boolean;
  rateRequested?: boolean;
}) {
  const { locale, t } = useI18n();
  const [chatOpen, setChatOpen] = useState(chatRequested);
  const [rateOpen, setRateOpen] = useState(rateRequested);
  // Links clicked while already on /orders don't remount the page, so open
  // again whenever a request for this order comes in.
  const [requested, setRequested] = useState({ chat: chatRequested, rate: rateRequested });
  if (requested.chat !== chatRequested || requested.rate !== rateRequested) {
    setRequested({ chat: chatRequested, rate: rateRequested });
    if (chatRequested && !requested.chat) setChatOpen(true);
    if (rateRequested && !requested.rate) setRateOpen(true);
  }
  const unread = order.unreadMessages ?? 0;
  const markChatRead = useCallback(() => {
    if (unread > 0) onUpdated({ ...order, unreadMessages: 0 });
  }, [order, unread, onUpdated]);
  const [completing, setCompleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // The rating this side gave the other once the order completed.
  const givenRating = role === "buyer" ? order.reviewRating : order.buyerReviewRating;
  const otherName = role === "buyer" ? order.sellerName : order.buyerName;

  async function handleComplete() {
    setCompleting(true);
    setError(null);
    try {
      onUpdated(await completeOrder(order.id));
    } catch (err) {
      setError(errorMessage(err, t, locale, t.orders.updateError));
    } finally {
      setCompleting(false);
    }
  }

  return (
    <div className="py-3">
      <div className="flex items-center gap-3">
        <Link href={`/listing/${order.listingId}`} className="flex min-w-0 flex-1 items-center gap-3">
          <PlaceholderImage seed={order.listingImage} category="other" className="h-12 w-12 shrink-0 rounded-lg" />
          <div className="min-w-0 flex-1">
            <p className="line-clamp-1 text-sm font-semibold text-ink">{order.listingTitle}</p>
            <p className="text-xs text-ink-400">
              {role === "buyer" ? t.common.sellerName(order.sellerName) : t.common.buyerName(order.buyerName)}{" "}
              &middot; {formatDate(order.createdAt, locale)}
            </p>
            {role === "seller" && <BuyerReputation order={order} />}
          </div>
        </Link>
        <div className="text-right">
          <p className="text-sm font-bold text-ink">{formatCurrency(order.price, locale)}</p>
          <Badge tone={statusTone[order.status]}>{t.orders.status[order.status]}</Badge>
        </div>
        <button
          onClick={() => setChatOpen(true)}
          className="relative shrink-0 rounded-full p-2 text-ink-600 hover:bg-cream-100"
          aria-label={unread > 0 ? `${t.orders.chat} · ${t.orders.unreadMessages(unread)}` : t.orders.chat}
          title={t.orders.chat}
        >
          <MessageCircle size={20} />
          {unread > 0 && (
            <span className="absolute top-0.5 right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-danger px-1 text-[10px] font-bold text-white">
              {unread}
            </span>
          )}
        </button>
      </div>
      <OrderChat order={order} role={role} open={chatOpen} onClose={() => setChatOpen(false)} onRead={markChatRead} />
      {role === "seller" && order.deliveryAddress && (
        <p className="mt-2 flex items-start gap-1.5 rounded-lg bg-cream-100 px-3 py-2 text-xs text-ink-600">
          <MapPin size={13} className="mt-0.5 shrink-0" />
          <span>
            <span className="font-semibold">{t.orders.deliverTo}</span> {formatAddress(order.deliveryAddress)}
            {order.buyerPhone && <> &middot; {order.buyerPhone}</>}
          </span>
        </p>
      )}
      {!order.isStoreOrder && <OrderHandoff order={order} role={role} onUpdated={onUpdated} />}
      {order.status === "completed" && (
        <div className="mt-2 flex items-center justify-end gap-2">
          {givenRating ? (
            <p className="flex items-center gap-1.5 text-xs text-ink-400">
              {t.orders.youRated(otherName)} <StarRating value={givenRating} size={13} />
            </p>
          ) : (
            <>
              <Button variant="secondary" size="sm" onClick={() => setRateOpen(true)}>
                <Star size={14} /> {role === "buyer" ? t.orders.rateSeller : t.orders.rateBuyer}
              </Button>
              <RateOrderModal
                order={order}
                target={role === "buyer" ? "seller" : "buyer"}
                open={rateOpen}
                onClose={() => setRateOpen(false)}
                onRated={onUpdated}
              />
            </>
          )}
        </div>
      )}
      {order.isStoreOrder && openStatuses.includes(order.status) && (
        <div className="mt-2 flex items-center justify-end gap-3">
          {error && <p className="text-xs text-danger">{error}</p>}
          <Button variant="secondary" size="sm" onClick={handleComplete} disabled={completing}>
            <CircleCheck size={14} /> {completing ? t.common.saving : t.orders.markDelivered}
          </Button>
        </div>
      )}
    </div>
  );
}

function NotificationRow({
  notification,
  onRead,
}: {
  notification: Notification;
  onRead: (id: string) => void;
}) {
  const { t, locale } = useI18n();
  const Icon = notificationIcon[notification.type];
  const { title, body } = notificationText(notification, t, locale);
  const content = (
    <div
      className={`flex items-start gap-3 rounded-lg px-2 py-2.5 ${
        !notification.read ? "bg-amber-100/50" : ""
      }`}
    >
      <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-cream-100 text-ink-600">
        <Icon size={14} />
      </span>
      <div className="min-w-0 flex-1" title={body ? `${title}\n${body}` : title}>
        <p className="text-sm font-semibold leading-snug text-ink break-words">{title}</p>
        <p className="mt-0.5 text-xs text-ink-400 line-clamp-3 break-words">{body}</p>
        <p className="mt-0.5 text-[11px] text-ink-400">{formatRelativeTime(notification.createdAt, locale)}</p>
      </div>
      {!notification.read && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-amber-500" />}
    </div>
  );

  return notification.href ? (
    <Link href={notification.href} onClick={() => onRead(notification.id)}>
      {content}
    </Link>
  ) : (
    <button onClick={() => onRead(notification.id)} className="w-full text-left">
      {content}
    </button>
  );
}

export function OrdersView() {
  const { user } = useAuth();
  const { t } = useI18n();
  const [orders, setOrders] = useState<Order[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  // Message notifications link to /orders?chat=<orderId> to open that chat,
  // and completed-order notifications to /orders?rate=<orderId> to rate it.
  const searchParams = useSearchParams();
  const chatOrderId = searchParams.get("chat");
  const rateOrderId = searchParams.get("rate");

  const load = useCallback(() => {
    return Promise.all([fetchMyOrders(), fetchNotifications()]).then(([ordersData, notificationsData]) => {
      setOrders(ordersData);
      setNotifications(notificationsData);
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Merged, because order actions return the order without its unread count.
  const handleOrderUpdated = useCallback((updated: Order) => {
    setOrders((prev) => prev.map((o) => (o.id === updated.id ? { ...o, ...updated } : o)));
  }, []);

  if (!user || loading) return null;

  const purchases = orders.filter((o) => o.buyerId === user.id);
  const sales = orders.filter((o) => o.sellerId === user.id);
  const unreadCount = notifications.filter((n) => !n.read).length;

  async function handleMarkRead(id: string) {
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
    await apiMarkRead(id);
  }

  async function handleMarkAllRead() {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    await apiMarkAllRead();
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <h1 className="mb-6 text-2xl font-black text-ink">{t.orders.title}</h1>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_320px]">
        <div className="flex flex-col gap-6">
          <Card>
            <CardBody>
              <h2 className="mb-1 font-bold text-ink">{t.orders.purchases}</h2>
              <p className="mb-2 text-xs text-ink-400">{t.orders.purchasesHint}</p>
              {purchases.length === 0 ? (
                <p className="py-6 text-center text-sm text-ink-400">{t.orders.noPurchases}</p>
              ) : (
                <div className="divide-y divide-line">
                  {purchases.map((o) => (
                    <OrderRow
                      key={o.id}
                      order={o}
                      role="buyer"
                      onUpdated={handleOrderUpdated}
                      chatRequested={o.id === chatOrderId}
                      rateRequested={o.id === rateOrderId}
                    />
                  ))}
                </div>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardBody>
              <h2 className="mb-1 flex items-center gap-1.5 font-bold text-ink">
                <PackageCheck size={16} /> {t.orders.sales}
              </h2>
              <p className="mb-2 text-xs text-ink-400">{t.orders.salesHint}</p>
              {sales.length === 0 ? (
                <p className="py-6 text-center text-sm text-ink-400">{t.orders.noSales}</p>
              ) : (
                <div className="divide-y divide-line">
                  {sales.map((o) => (
                    <OrderRow
                      key={o.id}
                      order={o}
                      role="seller"
                      onUpdated={handleOrderUpdated}
                      chatRequested={o.id === chatOrderId}
                      rateRequested={o.id === rateOrderId}
                    />
                  ))}
                </div>
              )}
            </CardBody>
          </Card>
        </div>

        <Card className="h-fit">
          <CardBody>
            <div className="mb-2 flex items-center justify-between">
              <h2 className="flex items-center gap-1.5 font-bold text-ink">
                <Bell size={16} /> {t.orders.notifications}
              </h2>
              {unreadCount > 0 && (
                <button
                  onClick={handleMarkAllRead}
                  className="flex items-center gap-1 text-xs font-medium text-ink-400 hover:text-ink"
                >
                  <CheckCheck size={13} /> {t.orders.markAllRead}
                </button>
              )}
            </div>
            {notifications.length === 0 ? (
              <p className="py-6 text-center text-sm text-ink-400">{t.orders.caughtUp}</p>
            ) : (
              <div className="flex flex-col gap-1">
                {notifications.map((n) => (
                  <NotificationRow key={n.id} notification={n} onRead={handleMarkRead} />
                ))}
              </div>
            )}
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
