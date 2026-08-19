var supabase = window.supabase.createClient(
    "https://xswkxjymswnveppratwx.supabase.co",
    "sb_publishable_ML6SKo4r_uB6TzkQuK9gNQ_VPCKj-h1"
);

let currentUserId = null;

document.addEventListener('DOMContentLoaded', async () => {
    await checkAuth();
    setupNavigationButtons();
    setupNotificationsUI();
    setupLogoutButton();

    await loadInitialData();
    subscribeToNotifications();
});

async function checkAuth() {
    const { data: { session } } = await supabase.auth.getSession();
    const localLoggedIn = localStorage.getItem('isLoggedIn');

    if (!session && !localLoggedIn) {
        window.location.href = "index.html";
        return;
    }

    let displayName = localStorage.getItem('userName');

    if (session && session.user) {
        currentUserId = session.user.id;
        const user = session.user;
        const metadata = user.user_metadata;

        displayName = metadata?.full_name ||
            metadata?.first_name ||
            metadata?.display_name ||
            displayName ||
            (user.email ? user.email.split('@')[0] : "Student");
    }

    const userNameElement = document.getElementById('userName');
    if (userNameElement && displayName) {
        userNameElement.textContent = displayName;
    }

    const profileBadgeName = document.getElementById('profileBadgeName');
    if (profileBadgeName && displayName) {
        profileBadgeName.textContent = displayName;
    }
}

function setupNavigationButtons() {
    const createPostBtn = document.getElementById('createPostBtn');
    const createEventBtn = document.getElementById('createEventBtn');
    const findPartnerBtn = document.getElementById('findPartnerBtn');
    const pollBtn = document.getElementById('pollBtn');

    if (createPostBtn) {
        createPostBtn.addEventListener('click', () => {
            window.location.href = "post.html";
        });
    }

    if (createEventBtn) {
        createEventBtn.addEventListener('click', () => {
            window.location.href = "event.html";
        });
    }

    if (findPartnerBtn) {
        findPartnerBtn.addEventListener('click', () => {
            window.location.href = "find.html";
        });
    }

    if (pollBtn) {
        pollBtn.addEventListener('click', () => {
            window.location.href = "poll.html";
        });
    }
}

async function loadInitialData() {
    await Promise.all([
        loadNotifications(),
        loadAllPosts(),
        loadAllEvents(),
        loadAllAnnouncements()
    ]);
}

function setupNotificationsUI() {
    const notifBtn = document.getElementById('notifBtn');
    const notifDrawer = document.getElementById('notifDrawer');
    const markReadBtn = document.getElementById('markReadBtn');

    if (notifBtn && notifDrawer) {
        notifBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            notifDrawer.classList.toggle('hidden');
        });

        document.addEventListener('click', (e) => {
            if (!notifDrawer.contains(e.target) && !notifBtn.contains(e.target)) {
                notifDrawer.classList.add('hidden');
            }
        });
    }

    if (markReadBtn) {
        markReadBtn.addEventListener('click', async () => {
            if (!currentUserId) {
                const { data: { session } } = await supabase.auth.getSession();
                if (session?.user) currentUserId = session.user.id;
            }

            if (!currentUserId) return;

            const { error } = await supabase
                .from('notifications')
                .update({ is_read: true })
                .eq('user_id', currentUserId)
                .eq('is_read', false);

            if (!error) {
                await loadNotifications();
                Swal.fire({
                    toast: true,
                    position: 'top-end',
                    icon: 'success',
                    title: 'Notifications marked as read',
                    showConfirmButton: false,
                    timer: 1500,
                    background: '#1f293d',
                    color: '#f8fafc'
                });
            }
        });
    }
}

async function sendNotification({ recipientId, type, message, targetId }) {
    if (!currentUserId) {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) currentUserId = session.user.id;
    }

    if (!currentUserId || (recipientId && recipientId === currentUserId)) return;

    const { data: { session } } = await supabase.auth.getSession();
    const metadata = session?.user?.user_metadata;
    const actorName = metadata?.full_name || metadata?.first_name || localStorage.getItem('userName') || "Someone";

    if (!recipientId) {
        const { data: users } = await supabase.from('profiles').select('id');
        if (users && users.length > 0) {
            const notifs = users
                .filter(u => u.id !== currentUserId)
                .map(u => ({
                    user_id: u.id,
                    actor_id: currentUserId,
                    actor_name: actorName,
                    type,
                    message,
                    target_id: targetId
                }));
            await supabase.from('notifications').insert(notifs);
        }
        return;
    }

    await supabase.from('notifications').insert([{
        user_id: recipientId,
        actor_id: currentUserId,
        actor_name: actorName,
        type: type,
        message: message,
        target_id: targetId
    }]);
}

async function loadNotifications() {
    if (!currentUserId) {
        const { data: { session } } = await supabase.auth.getSession();
        if (session && session.user) {
            currentUserId = session.user.id;
        } else {
            return;
        }
    }

    const notifBadge = document.getElementById('statNotifications');
    const notifContainer = document.getElementById('notifContainer');

    const { data: notifications, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', currentUserId)
        .order('created_at', { ascending: false })
        .limit(20);

    if (error) {
        console.error('Supabase Notification Error:', error.message);
        if (notifContainer) {
            notifContainer.innerHTML = `<p class="p-4 text-xs text-red-400 text-center">Failed to load notifications.</p>`;
        }
        return;
    }

    if (!notifications) return;

    const unreadCount = notifications.filter(n => !n.is_read).length;
    if (notifBadge) {
        if (unreadCount > 0) {
            notifBadge.textContent = unreadCount > 9 ? '9+' : unreadCount;
            notifBadge.classList.remove('hidden');
        } else {
            notifBadge.classList.add('hidden');
        }
    }

    if (!notifContainer) return;

    if (notifications.length === 0) {
        notifContainer.innerHTML = `<p class="p-4 text-xs text-gray-500 text-center">No notifications yet.</p>`;
        return;
    }

    notifContainer.innerHTML = notifications.map(n => `
        <div class="p-3 text-xs flex items-start gap-2.5 transition ${n.is_read ? 'opacity-60' : 'bg-gray-800/80'}">
            <span class="text-base leading-none">
                ${n.type === 'like' ? '❤️' : n.type === 'comment' ? '💬' : n.type === 'event_join' ? '📅' : '📢'}
            </span>
            <div class="flex-1 min-w-0">
                <p class="text-gray-200"><strong class="text-cyan-400">${n.actor_name || 'Someone'}</strong> ${n.message}</p>
                <span class="text-[10px] text-gray-500 mt-1 block">${new Date(n.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
            </div>
            ${!n.is_read ? `<span class="w-2 h-2 rounded-full bg-cyan-400 mt-1.5 flex-shrink-0"></span>` : ''}
        </div>
    `).join('');
}

function subscribeToNotifications() {
    if (!currentUserId) return;

    supabase
        .channel('public:notifications')
        .on('postgres_changes', {
            event: 'INSERT',
            schema: 'public',
            table: 'notifications',
            filter: `user_id=eq.${currentUserId}`
        }, payload => {
            loadNotifications();

            Swal.fire({
                toast: true,
                position: 'top-end',
                icon: 'info',
                title: `${payload.new.actor_name || 'Someone'} ${payload.new.message}`,
                showConfirmButton: false,
                timer: 3000,
                background: '#1f293d',
                color: '#f8fafc'
            });
        })
        .subscribe();
}

window.likePost = async function (postId, postOwnerId) {
    if (!currentUserId) {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) currentUserId = session.user.id;
    }

    await sendNotification({
        recipientId: postOwnerId,
        type: 'like',
        message: 'liked your post.',
        targetId: postId
    });

    Swal.fire({
        toast: true,
        position: 'top-end',
        icon: 'success',
        title: 'Post Liked',
        timer: 1200,
        showConfirmButton: false,
        background: '#1f293d',
        color: '#f8fafc'
    });
};

window.postComment = async function (postId, postOwnerId) {
    const input = document.getElementById(`input-comment-${postId}`);
    const content = input ? input.value.trim() : '';

    if (!content) return;

    if (!currentUserId) {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) currentUserId = session.user.id;
    }

    const metadata = (await supabase.auth.getSession()).data.session?.user?.user_metadata;
    const authorName = metadata?.full_name || metadata?.first_name || localStorage.getItem('userName') || "Student";

    const { error } = await supabase.from('comments').insert([{
        post_id: postId,
        user_id: currentUserId,
        author_name: authorName,
        user_name: authorName,
        content: content,
        comment_text: content
    }]);

    if (error) {
        console.error("Comment insert error:", error.message);
        return;
    }

    input.value = '';

    await sendNotification({
        recipientId: postOwnerId,
        type: 'comment',
        message: 'commented on your post.',
        targetId: postId
    });

    await loadAllPosts();
};

window.joinEvent = async function (eventId, eventOwnerId) {
    if (!currentUserId) {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) currentUserId = session.user.id;
    }

    await sendNotification({
        recipientId: eventOwnerId,
        type: 'event_join',
        message: 'joined your event.',
        targetId: eventId
    });

    Swal.fire({
        toast: true,
        position: 'top-end',
        icon: 'success',
        title: 'Joined Event!',
        timer: 1500,
        showConfirmButton: false,
        background: '#1f293d',
        color: '#f8fafc'
    });
};

async function loadAllPosts() {
    const container = document.getElementById('postsContainer');
    if (!container) return;

    const { data: posts, error } = await supabase
        .from('posts')
        .select('*')
        .order('created_at', { ascending: false });

    if (error) {
        console.error('Error fetching posts:', error.message);
        container.innerHTML = `<p class="text-red-400 text-sm">Failed to load posts.</p>`;
        return;
    }

    if (!posts || posts.length === 0) {
        container.innerHTML = `<p class="text-gray-400 text-sm">No posts available yet.</p>`;
        return;
    }

    container.innerHTML = posts.map(post => `
        <div class="bg-gray-800 p-5 rounded-xl mb-4 text-white border border-gray-700 shadow-md">
            <h3 class="text-xl font-bold text-cyan-400">${post.title || 'Untitled Post'}</h3>
            <p class="text-gray-300 mt-2 text-sm leading-relaxed">${post.description || ''}</p>
            
            <div class="flex items-center justify-between mt-4 pt-3 border-t border-gray-700/50 text-xs text-gray-400">
                <span class="font-medium text-slate-300">By ${post.author_name || 'Anonymous'}</span>
                <div class="flex items-center gap-3">
                    <button onclick="likePost('${post.id}', '${post.user_id || ''}')" class="hover:text-red-400 transition flex items-center gap-1">
                        ❤️ Like
                    </button>
                    <span>${post.created_at ? new Date(post.created_at).toLocaleDateString() : 'Just now'}</span>
                </div>
            </div>

            <div class="mt-3 pt-2 border-t border-gray-700/30 flex gap-2">
                <input type="text" id="input-comment-${post.id}" placeholder="Write a comment..." class="w-full bg-gray-900 border border-gray-700 text-xs text-white rounded px-2.5 py-1.5 focus:outline-none focus:border-cyan-500">
                <button onclick="postComment('${post.id}', '${post.user_id || ''}')" class="bg-cyan-500 hover:bg-cyan-600 text-gray-900 font-bold text-xs px-3 py-1.5 rounded transition">Comment</button>
            </div>
        </div>
    `).join('');

    if (typeof window.animatePostCards === 'function') {
        window.animatePostCards();
    }
}

async function loadAllEvents() {
    const container = document.getElementById('eventsContainer');
    if (!container) return;

    const { data: events, error } = await supabase
        .from('events')
        .select('*')
        .order('created_at', { ascending: false });

    if (error) {
        console.error('Error fetching events:', error.message);
        return;
    }

    if (!events || events.length === 0) {
        container.innerHTML = `<p class="text-gray-400 text-xs">No upcoming events.</p>`;
        return;
    }

    container.innerHTML = events.map(evt => `
        <div class="bg-gray-800 p-3 rounded-lg mb-3 border border-gray-700 flex items-center justify-between">
            <div class="flex items-center gap-4">
                <div class="bg-cyan-500 text-gray-900 font-bold p-2 rounded text-center min-w-[50px]">
                    <div class="text-[10px] uppercase tracking-wider">${evt.event_month || 'DEC'}</div>
                    <div class="text-base leading-none">${evt.event_date || '15'}</div>
                </div>
                <div>
                    <h4 class="font-bold text-white text-sm">${evt.title || 'Event'}</h4>
                    <p class="text-xs text-gray-400 mt-0.5">${evt.time_and_location || 'Campus'}</p>
                </div>
            </div>
            <button onclick="joinEvent('${evt.id}', '${evt.user_id || ''}')" class="bg-gray-700 hover:bg-cyan-500 hover:text-gray-900 text-cyan-400 text-xs font-semibold px-2.5 py-1 rounded transition">
                Join
            </button>
        </div>
    `).join('');
}

async function loadAllAnnouncements() {
    const container = document.getElementById('announcementsContainer');
    if (!container) return;

    const { data: announcements, error } = await supabase
        .from('announcements')
        .select('*')
        .order('created_at', { ascending: false });

    if (error) {
        console.error('Error fetching announcements:', error.message);
        return;
    }

    if (!announcements || announcements.length === 0) {
        container.innerHTML = `<p class="text-gray-400 text-xs">No announcements.</p>`;
        return;
    }

    container.innerHTML = announcements.map(anc => `
        <div class="bg-gray-800/80 p-3.5 rounded-lg mb-3 border border-gray-700">
            <span class="inline-block bg-cyan-950 text-cyan-400 text-[10px] font-semibold px-2 py-0.5 rounded border border-cyan-800/50 mb-1">
                ${anc.category || 'General'}
            </span>
            <h4 class="font-semibold text-white text-sm">${anc.title || 'Announcement'}</h4>
            <p class="text-xs text-gray-300 mt-1">${anc.description || ''}</p>
        </div>
    `).join('');
}

function setupLogoutButton() {
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', async (e) => {
            e.preventDefault();
            try {
                await supabase.auth.signOut();
                localStorage.removeItem('isLoggedIn');
                localStorage.removeItem('userName');
                window.location.href = "index.html";
            } catch (error) {
                console.error("Logout error:", error);
            }
        });
    }
}