var supabase = window.supabase.createClient(
    "https://xswkxjymswnveppratwx.supabase.co",
    "sb_publishable_ML6SKo4r_uB6TzkQuK9gNQ_VPCKj-h1"
);

let currentUserId = null;
let allPostsData = [];
let editingPostId = null;
let editingExistingImageUrl = null;

// Image Preview Handler
window.previewImage = function (input) {
    const container = document.getElementById('imagePreviewContainer');
    const preview = document.getElementById('imagePreview');
    const uploadText = document.getElementById('uploadText');

    if (input && input.files && input.files[0]) {
        const reader = new FileReader();
        reader.onload = function (e) {
            if (preview) preview.src = e.target.result;
            if (container) container.classList.remove('d-none');
            if (uploadText) uploadText.textContent = "Change Image";
        };
        reader.readAsDataURL(input.files[0]);
    } else if (editingExistingImageUrl) {
        if (preview) preview.src = editingExistingImageUrl;
        if (container) container.classList.remove('d-none');
        if (uploadText) uploadText.textContent = "Change Image";
    } else {
        if (container) container.classList.add('d-none');
        if (uploadText) uploadText.textContent = "Add Image";
    }
};

window.searchPosts = function (sourceInputId) {
    const inputElement = document.getElementById(sourceInputId);
    if (!inputElement) return;

    const query = inputElement.value.toLowerCase().trim();
    const navInput = document.getElementById('navSearchInput');
    const feedInput = document.getElementById('feedSearchInput');
    if (navInput) navInput.value = inputElement.value;
    if (feedInput) feedInput.value = inputElement.value;

    const filtered = allPostsData.filter(p =>
        (p.title && p.title.toLowerCase().includes(query)) ||
        (p.description && p.description.toLowerCase().includes(query)) ||
        (p.author_name && p.author_name.toLowerCase().includes(query))
    );

    renderPosts(filtered);
};

// Create OR Update Post
window.post = async function (e) {
    if (e) e.preventDefault();
    const title = document.getElementById('title').value.trim();
    const description = document.getElementById('description').value.trim();
    const fileInput = document.getElementById('background-image');
    const postBtn = document.getElementById('postBtn');

    if (!title || !description) return;

    postBtn.disabled = true;
    postBtn.textContent = editingPostId ? 'Updating...' : 'Publishing...';

    try {
        let imageUrl = editingExistingImageUrl;

        // Check if user selected a NEW image file
        if (fileInput && fileInput.files && fileInput.files.length > 0) {
            const file = fileInput.files[0];
            const fileExt = file.name.split('.').pop();
            const fileName = `post_${Date.now()}_${Math.floor(Math.random() * 1000)}.${fileExt}`;

            // Upload image to Supabase Storage
            const { data: uploadData, error: uploadError } = await supabase.storage
                .from('posts')
                .upload(fileName, file, { cacheControl: '3600', upsert: true });

            if (uploadError) {
                console.error("Storage upload error:", uploadError);
                throw new Error("Image upload failed: " + uploadError.message);
            }

            // Fetch public URL
            const { data: publicUrlData } = supabase.storage
                .from('posts')
                .getPublicUrl(fileName);

            imageUrl = publicUrlData.publicUrl;
        }

        if (editingPostId) {
            // Update Post
            const { error: updateError } = await supabase
                .from('posts')
                .update({
                    title: title,
                    description: description,
                    image_url: imageUrl
                })
                .eq('id', editingPostId);

            if (updateError) throw updateError;
        } else {
            // Create Post
            const { data: { session } } = await supabase.auth.getSession();
            const metadata = session?.user?.user_metadata;
            const authorName = metadata?.full_name || metadata?.first_name || localStorage.getItem('userName') || 'Student';

            const { error: insertError } = await supabase.from('posts').insert([{
                title: title,
                description: description,
                image_url: imageUrl,
                user_id: currentUserId,
                author_name: authorName
            }]);

            if (insertError) throw insertError;
        }

        resetFormState();

        Swal.fire({
            icon: 'success',
            title: 'Saved Successfully!',
            timer: 1500,
            showConfirmButton: false,
            background: '#1e293b',
            color: '#f8fafc'
        });

        await loadAllPosts();

    } catch (err) {
        console.error("Post Operation Error:", err);
        Swal.fire({
            icon: 'error',
            title: 'Error',
            text: err.message || 'Failed to process post.',
            background: '#1e293b',
            color: '#f8fafc'
        });
    } finally {
        postBtn.disabled = false;
        if (!editingPostId) postBtn.textContent = 'Publish Post';
    }
};

function resetFormState() {
    editingPostId = null;
    editingExistingImageUrl = null;
    document.getElementById('postForm').reset();

    const formTitle = document.getElementById('formTitle');
    const postBtn = document.getElementById('postBtn');
    const container = document.getElementById('imagePreviewContainer');
    const uploadText = document.getElementById('uploadText');

    if (formTitle) formTitle.textContent = "Create Post";
    if (postBtn) postBtn.textContent = "Publish Post";
    if (container) container.classList.add('d-none');
    if (uploadText) uploadText.textContent = "Add Image";
}

// Edit Post Handler
window.editPost = function (postId) {
    const postToEdit = allPostsData.find(p => p.id === postId);
    if (!postToEdit) return;

    editingPostId = postToEdit.id;
    editingExistingImageUrl = postToEdit.image_url || null;

    document.getElementById('title').value = postToEdit.title || '';
    document.getElementById('description').value = postToEdit.description || '';

    // Reset file input selection
    const fileInput = document.getElementById('background-image');
    if (fileInput) fileInput.value = '';

    const formTitle = document.getElementById('formTitle');
    const postBtn = document.getElementById('postBtn');
    const uploadText = document.getElementById('uploadText');
    const preview = document.getElementById('imagePreview');
    const container = document.getElementById('imagePreviewContainer');

    if (formTitle) formTitle.textContent = "Edit Post";
    if (postBtn) postBtn.textContent = "Update Post";

    if (editingExistingImageUrl) {
        if (preview) preview.src = editingExistingImageUrl;
        if (container) container.classList.remove('d-none');
        if (uploadText) uploadText.textContent = "Change Image";
    } else {
        if (container) container.classList.add('d-none');
        if (uploadText) uploadText.textContent = "Add Image";
    }

    window.scrollTo({ top: 0, behavior: 'smooth' });
};

// Delete Post
window.deletePost = async function (postId) {
    const confirm = await Swal.fire({
        title: 'Delete post?',
        text: "This action cannot be undone.",
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#ef4444',
        cancelButtonColor: '#334155',
        confirmButtonText: 'Delete',
        background: '#1e293b',
        color: '#f8fafc'
    });

    if (confirm.isConfirmed) {
        const { error } = await supabase.from('posts').delete().eq('id', postId);
        if (!error) {
            await loadAllPosts();
        }
    }
};

// Like Toggle
window.likePost = function (postId) {
    const likeBtn = document.getElementById(`like-btn-${postId}`);
    if (likeBtn) {
        likeBtn.classList.toggle('liked');
        const icon = likeBtn.querySelector('i');
        if (icon) {
            icon.classList.toggle('fa-regular');
            icon.classList.toggle('fa-solid');
        }
    }
};

// Comment Box Toggle
window.toggleCommentBox = async function (postId) {
    const commentBox = document.getElementById(`comment-box-${postId}`);
    if (commentBox) {
        commentBox.classList.toggle('d-none');
        if (!commentBox.classList.contains('d-none')) {
            await loadComments(postId);
        }
    }
};

// Save Comment to Supabase
window.addComment = async function (postId) {
    const input = document.getElementById(`comment-input-${postId}`);
    const text = input ? input.value.trim() : '';

    if (!text) return;

    try {
        const { error } = await supabase.from('comments').insert([{
            post_id: postId,
            user_id: currentUserId,
            text: text
        }]);

        if (error) {
            console.error('Error adding comment:', error.message);
            Swal.fire({
                icon: 'error',
                title: 'Comment Error',
                text: error.message,
                background: '#1e293b',
                color: '#f8fafc'
            });
            return;
        }

        input.value = '';
        await loadComments(postId);

    } catch (err) {
        console.error("Comment submit error:", err);
    }
};

// Load Comments
async function loadComments(postId) {
    const list = document.getElementById(`comments-list-${postId}`);
    if (!list) return;

    const { data: comments, error } = await supabase
        .from('comments')
        .select('*')
        .eq('post_id', postId)
        .order('created_at', { ascending: true });

    if (error) {
        console.error('Error loading comments:', error.message);
        return;
    }

    if (!comments || comments.length === 0) {
        list.innerHTML = `<p class="text-muted text-xs py-1 my-0">No comments yet.</p>`;
        return;
    }

    list.innerHTML = comments.map(c => `
        <div class="p-2 comment-box mt-1 text-light text-xs rounded border border-secondary">
            ${c.text}
        </div>
    `).join('');
}

// Initialization
document.addEventListener('DOMContentLoaded', async () => {
    await checkAuth();
    setupLogoutButton();
    await loadAllPosts();

    const imageInput = document.getElementById('background-image');
    if (imageInput) {
        imageInput.addEventListener('change', function () {
            window.previewImage(this);
        });
    }
});

async function checkAuth() {
    const { data: { session } } = await supabase.auth.getSession();
    const localLoggedIn = localStorage.getItem('isLoggedIn');

    if (!session && !localLoggedIn) {
        window.location.href = "index.html";
        return;
    }

    if (session && session.user) {
        currentUserId = session.user.id;
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

async function loadAllPosts() {
    const container = document.getElementById('posts');
    if (!container) return;

    const { data: posts, error } = await supabase
        .from('posts')
        .select('*')
        .order('created_at', { ascending: false });

    if (error) {
        console.error('Error fetching posts:', error.message);
        container.innerHTML = `<p class="text-danger text-center">Failed to load posts.</p>`;
        return;
    }

    allPostsData = posts || [];
    renderPosts(allPostsData);
}

function renderPosts(posts) {
    const container = document.getElementById('posts');
    if (!container) return;

    if (posts.length === 0) {
        container.innerHTML = `<p class="text-muted text-center py-4">No posts found.</p>`;
        return;
    }

    container.innerHTML = posts.map(post => `
        <div class="card custom-card post-card mb-4 shadow-sm">
            <div class="card-header d-flex align-items-center justify-content-between py-2 px-3">
                <div class="d-flex align-items-center gap-2">
                    <i class="fa-solid fa-user text-info"></i>
                    <span class="fw-bold text-info text-sm">${post.author_name || 'Student'}</span>
                </div>
                ${post.user_id === currentUserId ? `
                    <div class="d-flex gap-2 align-items-center">
                        <button onclick="editPost('${post.id}')" class="btn btn-link text-info p-0 border-0 me-2" title="Edit Post">
                            <i class="fa-solid fa-pen-to-square"></i>
                        </button>
                        <button onclick="deletePost('${post.id}')" class="btn btn-link text-danger p-0 border-0" title="Delete Post">
                            <i class="fa-solid fa-trash-can"></i>
                        </button>
                    </div>
                ` : ''}
            </div>

            ${post.image_url ? `
                <img src="${post.image_url}" class="post-img-large" alt="Post Image">
            ` : ''}

            <div class="card-body p-3">
                <h5 class="fw-bold text-info mb-1">${post.title || 'Untitled'}</h5>
                <p class="text-light mb-3 text-sm">${post.description || ''}</p>

                <div class="d-flex align-items-center justify-content-between pt-2 border-top border-secondary">
                    <div class="d-flex align-items-center gap-3">
                        <button id="like-btn-${post.id}" class="like-btn d-flex align-items-center gap-1 text-sm" onclick="likePost('${post.id}')">
                            <i class="fa-regular fa-heart"></i>
                            <span>Like</span>
                        </button>
                        <button class="btn btn-link text-secondary p-0 text-decoration-none d-flex align-items-center gap-1 text-sm" onclick="toggleCommentBox('${post.id}')">
                            <i class="fa-regular fa-comment text-info"></i>
                            <span>Comment</span>
                        </button>
                    </div>
                    <span class="text-muted text-xs">${post.created_at ? new Date(post.created_at).toLocaleDateString() : 'Just now'}</span>
                </div>

                <div id="comment-box-${post.id}" class="mt-3 d-none">
                    <div class="input-group">
                        <input type="text" 
                               id="comment-input-${post.id}" 
                               class="form-control text-sm" 
                               placeholder="Write a comment..." 
                               onkeypress="if(event.key === 'Enter'){ event.preventDefault(); window.addComment('${post.id}'); }">
                        <button type="button" 
                                class="btn btn-info btn-sm fw-bold" 
                                onclick="window.addComment('${post.id}')">Post</button>
                    </div>
                    <div id="comments-list-${post.id}" class="mt-2"></div>
                </div>
            </div>
        </div>
    `).join('');
}