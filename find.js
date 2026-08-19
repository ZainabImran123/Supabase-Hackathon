var supabase = window.supabase.createClient(
    "https://xswkxjymswnveppratwx.supabase.co",
    "sb_publishable_ML6SKo4r_uB6TzkQuK9gNQ_VPCKj-h1"
);

document.addEventListener('DOMContentLoaded', async () => {
    await checkAuth();
    setupUIControls();
    setupFormSubmission();
    setupLogout();
    await loadRequests();
});

async function checkAuth() {
    const { data: { session } } = await supabase.auth.getSession();
    const localLoggedIn = localStorage.getItem('isLoggedIn');

    if (!session && !localLoggedIn) {
        window.location.href = "index.html";
    }
}

function setupUIControls() {
    const toggleBtn = document.getElementById('toggleFormBtn');
    const closeBtn = document.getElementById('closeFormBtn');
    const cancelBtn = document.getElementById('cancelFormBtn');
    const formModal = document.getElementById('formModal');
    const backBtn = document.getElementById('backBtn');

    window.togglePartnerForm = function () {
        if (formModal) {
            formModal.classList.toggle('hidden');
            if (!formModal.classList.contains('hidden') && typeof window.animateModal === 'function') {
                window.animateModal(formModal);
            }
        }
    };

    if (toggleBtn) toggleBtn.addEventListener('click', window.togglePartnerForm);
    if (closeBtn) closeBtn.addEventListener('click', window.togglePartnerForm);
    if (cancelBtn) cancelBtn.addEventListener('click', window.togglePartnerForm);

    if (backBtn) {
        backBtn.addEventListener('click', () => {
            window.location.href = "student.html";
        });
    }
}

function setupFormSubmission() {
    const form = document.getElementById('partnerForm');
    if (!form) return;

    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
            Swal.fire({
                icon: 'error',
                title: 'Unauthorized',
                text: 'You must be logged in to post a request.',
                background: '#1f293d',
                color: '#f8fafc'
            });
            return;
        }

        const user = session.user;
        const metadata = user.user_metadata;
        const studentName = metadata?.full_name || metadata?.first_name || localStorage.getItem('userName') || "Student";
        const avatarUrl = metadata?.avatar_url || metadata?.picture || null;

        const subject = document.getElementById('subjectInput').value.trim();
        const goal = document.getElementById('goalInput').value.trim();
        const preferredTime = document.getElementById('timeInput').value.trim();
        const contactInfo = document.getElementById('contactInput').value.trim();

        const submitBtn = document.getElementById('submitRequestBtn');
        submitBtn.disabled = true;
        submitBtn.textContent = 'Posting...';

        const { error } = await supabase
            .from('study_partners')
            .insert([
                {
                    user_id: user.id,
                    student_name: studentName,
                    avatar_url: avatarUrl,
                    subject: subject,
                    topic_or_goal: goal,
                    preferred_time: preferredTime,
                    contact_info: contactInfo,
                    status: 'open'
                }
            ]);

        submitBtn.disabled = false;
        submitBtn.textContent = 'Post Request';

        if (error) {
            console.error('Error adding request:', error.message);
            Swal.fire({
                icon: 'error',
                title: 'Failed to Post',
                text: error.message,
                background: '#1f293d',
                color: '#f8fafc'
            });
            return;
        }

        form.reset();
        window.togglePartnerForm();

        Swal.fire({
            icon: 'success',
            title: 'Posted!',
            text: 'Your study partner request is live.',
            timer: 1500,
            showConfirmButton: false,
            background: '#1f293d',
            color: '#f8fafc'
        });

        await loadRequests();
    });
}

async function loadRequests() {
    const container = document.getElementById('requestsContainer');
    if (!container) return;

    const { data: requests, error } = await supabase
        .from('study_partners')
        .select('*')
        .order('created_at', { ascending: false });

    if (error) {
        console.error('Error fetching requests:', error.message);
        container.innerHTML = `<p class="text-red-400 text-sm col-span-full">Failed to load requests.</p>`;
        return;
    }

    if (!requests || requests.length === 0) {
        container.innerHTML = `<p class="text-gray-400 text-sm col-span-full">No active study requests right now.</p>`;
        return;
    }

    container.innerHTML = requests.map(req => {
        const initial = req.student_name ? req.student_name.charAt(0).toUpperCase() : 'S';
        const avatarHTML = req.avatar_url
            ? `<img src="${req.avatar_url}" class="w-10 h-10 rounded-full object-cover border border-cyan-500">`
            : `<div class="w-10 h-10 rounded-full bg-cyan-500 text-gray-900 font-bold flex items-center justify-center">${initial}</div>`;

        return `
            <div class="bg-gray-800 border border-gray-700 rounded-xl p-5 flex flex-col justify-between shadow-lg">
                <div>
                    <div class="flex items-center gap-3 mb-3">
                        ${avatarHTML}
                        <div>
                            <h3 class="font-bold text-white text-base">${req.student_name || 'Student'}</h3>
                            <span class="text-xs text-cyan-400 font-medium">${req.subject || 'General Study'}</span>
                        </div>
                    </div>

                    <p class="text-gray-300 text-sm mb-4 leading-relaxed">${req.topic_or_goal || ''}</p>

                    ${req.preferred_time ? `
                        <div class="text-xs text-gray-400 mb-2 flex items-center gap-1.5">
                            <span>🕒</span> <span>${req.preferred_time}</span>
                        </div>
                    ` : ''}
                </div>

                <div class="pt-3 border-t border-gray-700/60 mt-2 flex justify-between items-center">
                    <span class="text-xs font-semibold text-gray-300 bg-gray-900 px-2.5 py-1 rounded border border-gray-700">
                        📞 ${req.contact_info || 'N/A'}
                    </span>
                    <span class="text-[10px] text-gray-500">
                        ${req.created_at ? new Date(req.created_at).toLocaleDateString() : 'Just now'}
                    </span>
                </div>
            </div>
        `;
    }).join('');

    if (typeof window.animatePostCards === 'function') {
        window.animatePostCards();
    }
}

function setupLogout() {
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', async () => {
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