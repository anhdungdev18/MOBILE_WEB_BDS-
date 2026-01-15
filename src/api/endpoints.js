export const ENDPOINTS = {
    LOGIN: '/api/accounts/login/',
    REFRESH: '/api/accounts/api/token/refresh/',

    REGISTER: '/api/accounts/signup/',
    PROFILE: '/api/accounts/profile',
    PROFILE_UPDATE: '/api/accounts/profile/update',
    AVATAR_UPLOAD: '/api/accounts/me/avatar/',
    FORGOT_PASSWORD: '/api/accounts/password/forgot/',
    RESET_PASSWORD: '/api/accounts/password/reset/',
    PASSWORD_CHANGE: '/api/accounts/password/change',
    // ✅ FIX 404
    POSTS: '/api/listings/posts',                 // ❗ bỏ dấu /
    POST_DETAIL: (id) => `/api/listings/posts/${id}`, // ❗ bỏ dấu /
    CATEGORIES: '/api/listings/categories/',

    POST_OWNER_STATUS: (id) => `/api/listings/posts/${id}/owner-status`,
    OWNER_STATUS: (id) => `/api/listings/posts/${id}/owner-status`,

    POST_DELETE: (id) => `/api/listings/posts/${id}`,

    USER_PUBLIC_PROFILE: (userId) => `/api/accounts/users/${userId}/public-profile/`,

    UPLOAD_IMAGE: '/api/accounts/me/avatar/',

    CHATBOT: '/api/chatbot/',

    // Realtime chat
    CHAT_ROOMS: '/api/rooms/',
    CHAT_ROOMS_MY: '/api/rooms/my/',
    CHAT_ROOM_MESSAGES: (roomId) => `/api/rooms/${roomId}/messages/`,

    // Notifications
    NOTIFICATIONS: '/api/notifications/',
    NOTIFICATIONS_UNREAD: '/api/notifications/unread-count/',
    NOTIFICATIONS_MARK_READ: '/api/notifications/mark-read/',

    FAVORITES_TOGGLE: '/api/engagement/favorites/toggle/',
    FAVORITES_MY: '/api/engagement/favorites/my/',

    MY_POSTS: '/api/listings/me/posts',
    OWNER_POSTS: '/api/listings/owner-posts/',


    // RATINGS
    RATINGS_LIST_BY_POST: '/api/engagement/ratings/list/',        // GET ?post_id=
    RATINGS_SUMMARY_BY_POST: '/api/engagement/ratings/summary/',  // GET ?post_id=

    // VIP / MEMBERSHIP (từ BE accounts/urls.py)
    MEMBERSHIP_ME: '/api/accounts/membership/me/',
    MEMBERSHIP_UPGRADE_INIT: '/api/accounts/membership/upgrade/init/',

};
