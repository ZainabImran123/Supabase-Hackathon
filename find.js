var supabase = window.supabase.createClient(
    "https://xswkxjymswnveppratwx.supabase.co",
    "sb_publishable_ML6SKo4r_uB6TzkQuK9gNQ_VPCKj-h1"
);

let currentUserId = null;

document.addEventListener('DOMContentLoaded', async () => {
    await checkAuth();
    setupUIControls();
    setupAvatarPreview();
    setupFormSubmission();
    setupLogout();
    await loadRequests();
});

async function checkAuth() {
    const { data: { session } } = await supabase.auth.getSession();
    const localLoggedIn = localStorage.getItem('isLoggedIn');

    if (!session && !localLoggedIn) {
        window.location.href = "index.html";
        return;
    }

    if (session) {
        currentUserId = session.user.id;
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

function setupAvatarPreview() {
    const avatarInput = document.getElementById('avatarInput');
    const avatarPreview = document.getElementById('avatarPreview');

    if (avatarInput && avatarPreview) {
        avatarInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                avatarPreview.src = URL.createObjectURL(file);
                avatarPreview.classList.remove('hidden');
            }
        });
    }
}

async function uploadAvatar(file, userId) {
    if (!file) return null;

    const fileExt = file.name.split('.').pop();
    const filePath = `avatars/${userId}_${Date.now()}.${fileExt}`;

    const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file, { upsert: true });

    if (uploadError) {
        console.error('Avatar upload failed:', uploadError.message);
        return null;
    }

    const { data } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath);

    return data.publicUrl;
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

        const avatarFileInput = document.getElementById('avatarInput');
        let avatarUrl = metadata?.avatar_url || metadata?.picture || null;

        const submitBtn = document.getElementById('submitRequestBtn');
        submitBtn.disabled = true;
        submitBtn.textContent = 'Posting...';

        if (avatarFileInput && avatarFileInput.files && avatarFileInput.files.length > 0) {
            const uploadedUrl = await uploadAvatar(avatarFileInput.files[0], user.id);
            if (uploadedUrl) avatarUrl = uploadedUrl;
        }

        const subject = document.getElementById('subjectInput').value.trim();
        const goal = document.getElementById('goalInput').value.trim();
        const preferredTime = document.getElementById('timeInput').value.trim();
        const contactInfo = document.getElementById('contactInput').value.trim();

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
        const avatarPreview = document.getElementById('avatarPreview');
        if (avatarPreview) avatarPreview.classList.add('hidden');

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

    // 1. Fetch study partner posts
    const { data: requests, error: reqError } = await supabase
        .from('study_partners')
        .select('*')
        .order('created_at', { ascending: false });

    if (reqError) {
        console.error('Error fetching requests:', reqError.message);
        container.innerHTML = `<p class="text-red-400 text-sm col-span-full">Failed to load requests.</p>`;
        return;
    }

    if (!requests || requests.length === 0) {
        container.innerHTML = `<p class="text-gray-400 text-sm col-span-full">No active study requests right now.</p>`;
        return;
    }

    // 2. Fetch comments independently
    const { data: comments, error: commError } = await supabase
        .from('comments')
        .select('*')
        .order('created_at', { ascending: true });

    if (commError) {
        console.warn('Comments fetch notice:', commError.message);
    }

    // 3. Map comments checking post_id
    const commentsMap = {};
    if (comments) {
        comments.forEach(c => {
            const pid = c.post_id || c.request_id;
            if (pid) {
                if (!commentsMap[pid]) commentsMap[pid] = [];
                commentsMap[pid].push(c);
            }
        });
    }

    container.innerHTML = requests.map(req => {
        const initial = req.student_name ? req.student_name.charAt(0).toUpperCase() : 'S';
        const avatarHTML = req.avatar_url
            ? `<img src="${req.avatar_url}" class="w-10 h-10 rounded-full object-cover border border-cyan-500">`
            : `<div class="w-10 h-10 rounded-full bg-cyan-500 text-gray-900 font-bold flex items-center justify-center">${initial}</div>`;

        const isOwner = currentUserId && req.user_id === currentUserId;
        const deleteBtnHTML = isOwner
            ? `<button onclick="deleteRequest('${req.id}')" class="text-gray-400 hover:text-red-400 transition-colors p-1" title="Delete Post">
                🗑️
               </button>`
            : '';

        const postComments = commentsMap[req.id] || [];
        const commentsList = postComments.map(c => `
            <div class="bg-gray-900/60 p-2.5 rounded border border-gray-700/50 text-xs mb-2">
                <div class="flex justify-between items-center text-gray-400 mb-1">
                    <span class="font-semibold text-cyan-400">${c.author_name || c.user_name || 'User'}</span>
                    <span class="text-[10px]">${new Date(c.created_at).toLocaleDateString()}</span>
                </div>
                <p class="text-gray-300">${c.comment_text || c.content || ''}</p>
            </div>
        `).join('');

        return `
            <div class="bg-gray-800 border border-gray-700 rounded-xl p-5 flex flex-col justify-between shadow-lg relative">
                <div>
                    <div class="flex items-center justify-between mb-3">
                        <div class="flex items-center gap-3">
                            ${avatarHTML}
                            <div>
                                <h3 class="font-bold text-white text-base">${req.student_name || 'Student'}</h3>
                                <span class="text-xs text-cyan-400 font-medium">${req.subject || 'General Study'}</span>
                            </div>
                        </div>
                        ${deleteBtnHTML}
                    </div>

                    <p class="text-gray-300 text-sm mb-4 leading-relaxed">${req.topic_or_goal || ''}</p>

                    ${req.preferred_time ? `
                        <div class="text-xs text-gray-400 mb-2 flex items-center gap-1.5">
                            <span>🕒</span> <span>${req.preferred_time}</span>
                        </div>
                    ` : ''}
                </div>

                <div>
                    <div class="pt-3 border-t border-gray-700/60 mt-2 flex justify-between items-center mb-4">
                        <span class="text-xs font-semibold text-gray-300 bg-gray-900 px-2.5 py-1 rounded border border-gray-700">
                            📞 ${req.contact_info || 'N/A'}
                        </span>
                        <span class="text-[10px] text-gray-500">
                            ${req.created_at ? new Date(req.created_at).toLocaleDateString() : 'Just now'}
                        </span>
                    </div>

                    <div class="mt-3 pt-3 border-t border-gray-700/40">
                        <button onclick="toggleComments('${req.id}')" class="text-xs text-cyan-400 font-medium hover:underline mb-2 flex items-center gap-1">
                            💬 Comments (${postComments.length})
                        </button>

                        <div id="comments-${req.id}" class="hidden space-y-2 mt-2">
                            <div class="max-h-36 overflow-y-auto pr-1">
                                ${commentsList.length > 0 ? commentsList : '<p class="text-xs text-gray-500 italic">No comments yet.</p>'}
                            </div>
                            <div class="flex gap-2 mt-2">
                                <input type="text" id="input-comment-${req.id}" placeholder="Write a comment..." class="w-full bg-gray-900 border border-gray-700 text-xs text-white rounded px-2.5 py-1.5 focus:outline-none focus:border-cyan-500">
                                <button onclick="postComment('${req.id}')" class="bg-cyan-500 hover:bg-cyan-600 text-gray-900 font-bold text-xs px-3 py-1.5 rounded transition-colors">Post</button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }).join('');

    if (typeof window.animatePostCards === 'function') {
        window.animatePostCards();
    }
}

window.toggleComments = function (requestId) {
    const commentsDiv = document.getElementById(`comments-${requestId}`);
    if (commentsDiv) {
        commentsDiv.classList.toggle('hidden');
    }
};

window.postComment = async function (requestId) {
    const input = document.getElementById(`input-comment-${requestId}`);
    const content = input ? input.value.trim() : '';

    if (!content) return;

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
        Swal.fire({
            icon: 'error',
            title: 'Unauthorized',
            text: 'You must be logged in to comment.',
            background: '#1f293d',
            color: '#f8fafc'
        });
        return;
    }

    const metadata = session.user.user_metadata;
    const authorName = metadata?.full_name || metadata?.first_name || localStorage.getItem('userName') || "Student";

    // Populate all potential name & text column variations to avoid NOT NULL constraints
    const { error } = await supabase
        .from('comments')
        .insert([
            {
                post_id: requestId,
                user_id: session.user.id,
                author_name: authorName,
                user_name: authorName,
                content: content,
                comment_text: content
            }
        ]);

    if (error) {
        console.error('Error posting comment:', error.message);
        Swal.fire({
            icon: 'error',
            title: 'Comment Failed',
            text: error.message,
            background: '#1f293d',
            color: '#f8fafc'
        });
        return;
    }

    input.value = '';
    await loadRequests();
};

window.deleteRequest = async function (requestId) {
    const result = await Swal.fire({
        title: 'Delete Request?',
        text: "This action cannot be undone.",
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#ef4444',
        cancelButtonColor: '#374151',
        confirmButtonText: 'Yes, delete it',
        background: '#1f293d',
        color: '#f8fafc'
    });

    if (result.isConfirmed) {
        const { error } = await supabase
            .from('study_partners')
            .delete()
            .eq('id', requestId)
            .eq('user_id', currentUserId);

        if (error) {
            console.error('Error deleting request:', error.message);
            Swal.fire({
                icon: 'error',
                title: 'Delete Failed',
                text: error.message,
                background: '#1f293d',
                color: '#f8fafc'
            });
            return;
        }

        Swal.fire({
            icon: 'success',
            title: 'Deleted',
            text: 'Your post has been removed.',
            timer: 1200,
            showConfirmButton: false,
            background: '#1f293d',
            color: '#f8fafc'
        });

        await loadRequests();
    }
};

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