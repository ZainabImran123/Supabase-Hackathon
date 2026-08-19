var supabase = window.supabase.createClient(
    "https://xswkxjymswnveppratwx.supabase.co",
    "sb_publishable_ML6SKo4r_uB6TzkQuK9gNQ_VPCKj-h1"
);

document.addEventListener('DOMContentLoaded', async () => {
    await checkAuth();
    setupNavigationButtons();
    setupNotificationActions();
    setupLogoutButton();

    await loadAllPosts();
    await loadAllEvents();
    await loadAllAnnouncements();
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
            <div class="flex justify-between items-center mt-4 pt-3 border-t border-gray-700/50 text-xs text-gray-400">
                <span class="font-medium text-slate-300">By ${post.author_name || 'Anonymous'}</span>
                <span>${post.created_at ? new Date(post.created_at).toLocaleDateString() : 'Just now'}</span>
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
        <div class="bg-gray-800 p-3 rounded-lg mb-3 border border-gray-700 flex items-center gap-4">
            <div class="bg-cyan-500 text-gray-900 font-bold p-2 rounded text-center min-w-[50px]">
                <div class="text-[10px] uppercase tracking-wider">${evt.event_month || 'DEC'}</div>
                <div class="text-base leading-none">${evt.event_date || '15'}</div>
            </div>
            <div>
                <h4 class="font-bold text-white text-sm">${evt.title || 'Event'}</h4>
                <p class="text-xs text-gray-400 mt-0.5">${evt.time_and_location || 'Campus'}</p>
            </div>
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

function setupNotificationActions() {
    const markReadBtn = document.getElementById('markReadBtn');
    const notificationsList = document.getElementById('notificationsList');
    const statNotifications = document.getElementById('statNotifications');

    if (markReadBtn) {
        markReadBtn.addEventListener('click', () => {
            if (notificationsList) notificationsList.style.opacity = '0.4';
            if (statNotifications) statNotifications.textContent = '0';

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
        });
    }
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