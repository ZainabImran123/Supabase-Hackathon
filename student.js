var supabase = window.supabase.createClient(
    "https://xswkxjymswnveppratwx.supabase.co",
    "sb_publishable_ML6SKo4r_uB6TzkQuK9gNQ_VPCKj-h1"
);

let currentUserId = null;

document.addEventListener('DOMContentLoaded', async () => {
    const isAuthenticated = await checkAuth();
    if (!isAuthenticated) return;

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
        return false;
    }

    let displayName = localStorage.getItem('userName');

    if (session?.user) {
        currentUserId = session.user.id;
        const metadata = session.user.user_metadata;

        displayName = metadata?.full_name ||
            metadata?.first_name ||
            metadata?.display_name ||
            displayName ||
            (session.user.email ? session.user.email.split('@')[0] : "Student");

        if (displayName) {
            localStorage.setItem('userName', displayName);
        }
    }

    const userNameElement = document.getElementById('userName');
    if (userNameElement && displayName) {
        userNameElement.textContent = displayName;
    }

    const profileBadgeName = document.getElementById('profileBadgeName');
    if (profileBadgeName && displayName) {
        profileBadgeName.textContent = displayName;
    }

    return true;
}

function setupNavigationButtons() {
    const navMap = {
        'createPostBtn': 'post.html',
        'createEventBtn': 'event.html',
        'findPartnerBtn': 'find.html',
        'pollBtn': 'poll.html'
    };

    Object.entries(navMap).forEach(([id, targetUrl]) => {
        const btn = document.getElementById(id);
        if (btn) {
            btn.addEventListener('click', () => {
                window.location.href = targetUrl;
            });
        }
    });
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
            let updateQuery = supabase.from('notifications').update({ is_read: true }).eq('is_read', false);

            if (currentUserId) {
                updateQuery = updateQuery.or(`user_id.eq.${currentUserId},user_id.is.null`);
            }

            const { error } = await updateQuery;

            if (!error) {
                await loadNotifications();
                if (typeof Swal !== 'undefined') {
                    Swal.fire({
                        toast: true,
                        position: 'top-end',
                        icon: 'success',
                        title: 'Notifications marked as read',
                        showConfirmButton: false,
                        timer: 1500,
                        background: '#111827',
                        color: '#f8fafc'
                    });
                }
            }
        });
    }
}

async function sendNotification({ recipientId, type, message, title }) {
    const targetRecipient = (recipientId && recipientId !== "undefined" && recipientId !== "null" && recipientId !== "")
        ? recipientId
        : currentUserId;

    const { error } = await supabase.from('notifications').insert([{
        user_id: targetRecipient || null,
        title: title || 'New Notification',
        message: message || 'You have a new update.',
        type: type || 'alert',
        is_read: false
    }]);

    if (error) {
        console.error("Error inserting notification:", error.message);
    } else {
        await loadNotifications();
    }
}

async function loadNotifications() {
    const notifBadge = document.getElementById('statNotifications');
    const notifContainer = document.getElementById('notifContainer');

    if (!notifContainer) return;

    let query = supabase
        .from('notifications')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(20);

    if (currentUserId) {
        query = query.or(`user_id.eq.${currentUserId},user_id.is.null`);
    }

    const { data: notifications, error } = await query;

    if (error) {
        console.error('Supabase Notification Error:', error.message);
        notifContainer.innerHTML = `<p class="p-4 text-xs text-red-400 text-center">Failed to load notifications.</p>`;
        return;
    }

    if (!notifications || notifications.length === 0) {
        notifContainer.innerHTML = `<p class="p-4 text-xs text-gray-400 text-center">No notifications yet.</p>`;
        if (notifBadge) notifBadge.classList.add('hidden');
        return;
    }

    const unreadCount = notifications.filter(n => !n.is_read).length;
    if (notifBadge) {
        if (unreadCount > 0) {
            notifBadge.textContent = unreadCount > 9 ? '9+' : unreadCount;
            notifBadge.classList.remove('hidden');
        } else {
            notifBadge.classList.add('hidden');
        }
    }

    const typeIcons = {
        like: '❤️',
        comment: '💬',
        event_join: '📅',
        system: '⚙️',
        alert: '📢'
    };

    notifContainer.innerHTML = notifications.map(n => `
        <div class="p-3 text-xs flex items-start gap-2.5 transition ${n.is_read ? 'opacity-60 bg-[#111827]' : 'bg-[#1f293d]/80'} border-b border-[#2d3748]/50">
            <span class="text-base leading-none">${typeIcons[n.type] || '📢'}</span>
            <div class="flex-1 min-w-0">
                <p class="text-gray-200"><strong class="text-[#22d3ee]">${escapeHTML(n.title || 'Notification')}</strong></p>
                <p class="text-gray-300 mt-0.5">${escapeHTML(n.message || '')}</p>
                <span class="text-[10px] text-gray-500 mt-1 block">${new Date(n.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
            </div>
            ${!n.is_read ? `<span class="w-2 h-2 rounded-full bg-[#22d3ee] mt-1.5 flex-shrink-0"></span>` : ''}
        </div>
    `).join('');
}

function subscribeToNotifications() {
    supabase
        .channel('public:notifications')
        .on('postgres_changes', {
            event: 'INSERT',
            schema: 'public',
            table: 'notifications'
        }, payload => {
            loadNotifications();

            if (typeof Swal !== 'undefined') {
                Swal.fire({
                    toast: true,
                    position: 'top-end',
                    icon: 'info',
                    title: payload.new.title || 'New Notification',
                    text: payload.new.message,
                    showConfirmButton: false,
                    timer: 3000,
                    background: '#111827',
                    color: '#f8fafc'
                });
            }
        })
        .subscribe();
}

window.likePost = async function (postId, postOwnerId) {
    const actorName = localStorage.getItem('userName') || "Someone";

    await sendNotification({
        recipientId: postOwnerId,
        type: 'like',
        title: `${actorName} liked your post`,
        message: 'Your post received a new reaction.'
    });

    if (typeof Swal !== 'undefined') {
        Swal.fire({
            toast: true,
            position: 'top-end',
            icon: 'success',
            title: 'Post Liked',
            timer: 1200,
            showConfirmButton: false,
            background: '#111827',
            color: '#f8fafc'
        });
    }
};

window.postComment = async function (postId, postOwnerId) {
    const input = document.getElementById(`input-comment-${postId}`);
    const content = input ? input.value.trim() : '';

    if (!content) return;

    const authorName = localStorage.getItem('userName') || "Student";

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
        title: `${authorName} commented on your post`,
        message: content
    });

    await loadAllPosts();
};

window.joinEvent = async function (eventId, eventOwnerId) {
    const actorName = localStorage.getItem('userName') || "Someone";

    await sendNotification({
        recipientId: eventOwnerId,
        type: 'event_join',
        title: `${actorName} joined your event`,
        message: 'A new user registered for your upcoming event.'
    });

    if (typeof Swal !== 'undefined') {
        Swal.fire({
            toast: true,
            position: 'top-end',
            icon: 'success',
            title: 'Joined Event!',
            timer: 1500,
            showConfirmButton: false,
            background: '#111827',
            color: '#f8fafc'
        });
    }
};

async function loadAllPosts() {
    const container = document.getElementById('postsContainer');
    if (!container) return;

    const { data: posts, error } = await supabase
        .from('posts')
        .select('*, comments(*)')
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

    container.innerHTML = posts.map(post => {
        const commentsList = (post.comments || []).map(c => `
            <div class="text-xs bg-[#090d16]/80 p-2 rounded mb-1.5 border border-[#2d3748]">
                <span class="font-bold text-[#22d3ee]">${escapeHTML(c.author_name || c.user_name || 'Student')}:</span>
                <span class="text-gray-200 ml-1">${escapeHTML(c.content || c.comment_text || '')}</span>
            </div>
        `).join('');

        return `
            <div class="bg-[#111827] p-5 rounded-xl mb-4 text-white border border-[#2d3748] shadow-md">
                <h3 class="text-xl font-bold text-[#22d3ee]">${escapeHTML(post.title || 'Untitled Post')}</h3>
                <p class="text-gray-300 mt-2 text-sm leading-relaxed">${escapeHTML(post.description || '')}</p>
                
                <div class="flex items-center justify-between mt-4 pt-3 border-t border-[#2d3748] text-xs text-gray-400">
                    <span class="font-medium text-slate-300">By ${escapeHTML(post.author_name || 'Anonymous')}</span>
                    <div class="flex items-center gap-3">
                        <button onclick="likePost('${post.id}', '${post.user_id || ''}')" class="hover:text-red-400 transition flex items-center gap-1">
                            ❤️ Like
                        </button>
                        <span>${post.created_at ? new Date(post.created_at).toLocaleDateString() : 'Just now'}</span>
                    </div>
                </div>

                <div class="mt-3 space-y-1">
                    ${commentsList}
                </div>

                <div class="mt-3 pt-2 border-t border-[#2d3748] flex gap-2">
                    <input type="text" id="input-comment-${post.id}" placeholder="Write a comment..." class="w-full bg-[#090d16] border border-[#2d3748] text-xs text-white rounded px-2.5 py-1.5 focus:outline-none focus:border-[#22d3ee]">
                    <button onclick="postComment('${post.id}', '${post.user_id || ''}')" class="bg-[#22d3ee] hover:bg-cyan-400 text-gray-900 font-bold text-xs px-3 py-1.5 rounded transition">Comment</button>
                </div>
            </div>
        `;
    }).join('');
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
        <div class="bg-[#111827] p-3 rounded-lg mb-3 border border-[#2d3748] flex items-center justify-between">
            <div class="flex items-center gap-4">
                <div class="bg-[#22d3ee] text-gray-900 font-bold p-2 rounded text-center min-w-[50px]">
                    <div class="text-[10px] uppercase tracking-wider">${escapeHTML(evt.event_month || 'DEC')}</div>
                    <div class="text-base leading-none">${escapeHTML(String(evt.event_date || '15'))}</div>
                </div>
                <div>
                    <h4 class="font-bold text-white text-sm">${escapeHTML(evt.title || 'Event')}</h4>
                    <p class="text-xs text-gray-400 mt-0.5">${escapeHTML(evt.time_and_location || 'Campus')}</p>
                </div>
            </div>
            <button onclick="joinEvent('${evt.id}', '${evt.user_id || ''}')" class="bg-[#1f293d] hover:bg-[#22d3ee] hover:text-gray-900 text-[#22d3ee] text-xs font-semibold px-2.5 py-1 rounded transition">
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
        <div class="bg-[#111827] p-3.5 rounded-lg mb-3 border border-[#2d3748]">
            <span class="inline-block bg-cyan-950 text-[#22d3ee] text-[10px] font-semibold px-2 py-0.5 rounded border border-cyan-800/50 mb-1">
                ${escapeHTML(anc.category || 'General')}
            </span>
            <h4 class="font-semibold text-white text-sm">${escapeHTML(anc.title || 'Announcement')}</h4>
            <p class="text-xs text-gray-300 mt-1">${escapeHTML(anc.description || '')}</p>
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

function escapeHTML(str) {
    return String(str ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}