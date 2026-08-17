const SUPABASE_URL = "https://xswkxjymswnveppratwx.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inhzd2t4anltc3dudmVwcHJhdHd4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY3OTQ5NTYsImV4cCI6MjEwMjM3MDk1Nn0.sOZhMZMfIBXKn9QgcPLUz9rmpwlHfNE52Bu8RBXIki0";

// Safe initialization check
let _supabase = null;
if (window.supabase && typeof window.supabase.createClient === 'function') {
    _supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
} else {
    console.error("Supabase SDK not loaded properly. Check your script tags in HTML.");
}

let currentUser = null;
let editPostId = null;

// Helper function to extract or display a user name
function getUserDisplayName(user) {
    if (!user) return "Anonymous";
    if (typeof user === 'string') return user.split('@')[0];
    return user.user_metadata?.full_name || (user.email ? user.email.split('@')[0] : "Anonymous");
}

document.addEventListener("DOMContentLoaded", async () => {
    if (!_supabase) return;

    const { data: { session }, error } = await _supabase.auth.getSession();

    if (error || !session) {
        window.location.href = "login.html";
        return;
    }

    currentUser = session.user;

    const charBtn = document.getElementById("char");
    if (charBtn && currentUser) {
        const name = getUserDisplayName(currentUser);
        charBtn.innerText = name.charAt(0).toUpperCase();
    }

    fetchPosts();
});

function toggleMenu() {
    document.getElementById("dropdownMenu").classList.toggle("show");
}

async function logout() {
    if (_supabase) await _supabase.auth.signOut();
    window.location.href = "login.html";
}

function previewImage(input) {
    const previewContainer = document.getElementById("imagePreviewContainer");
    const previewImage = document.getElementById("imagePreview");
    const uploadText = document.getElementById("uploadText");

    if (input.files && input.files[0]) {
        const reader = new FileReader();
        reader.onload = function (e) {
            previewImage.src = e.target.result;
            previewContainer.classList.remove("d-none");
        };
        reader.readAsDataURL(input.files[0]);
        uploadText.innerText = "Change Image";
    } else {
        previewImage.src = "";
        previewContainer.classList.add("d-none");
        uploadText.innerText = "Add Image";
    }
}

async function post(event) {
    event.preventDefault();

    if (!_supabase) {
        Swal.fire("Error", "Supabase client is not initialized.", "error");
        return;
    }

    const title = document.getElementById("title") ? document.getElementById("title").value.trim() : "";
    const description = document.getElementById("description") ? document.getElementById("description").value.trim() : "";
    const fileInput = document.getElementById("background-image");
    const file = fileInput ? fileInput.files[0] : null;

    let imageUrl = null;

    Swal.fire({
        title: editPostId ? "Updating Post..." : "Publishing Post...",
        allowOutsideClick: false,
        didOpen: () => Swal.showLoading()
    });

    try {
        if (file) {
            const fileName = `${Date.now()}_${file.name}`;
            const { error: uploadError } = await _supabase.storage
                .from("post-images")
                .upload(fileName, file);

            if (uploadError) throw uploadError;

            const { data: urlData } = _supabase.storage
                .from("post-images")
                .getPublicUrl(fileName);

            imageUrl = urlData.publicUrl;
        }

        const authorName = getUserDisplayName(currentUser);

        if (editPostId) {
            const updateData = { title, description };
            if (imageUrl) updateData.image_url = imageUrl;

            const { error } = await _supabase
                .from("posts")
                .update(updateData)
                .eq("id", editPostId);

            if (error) throw error;

            Swal.fire("Updated!", "Your post has been updated.", "success");
            editPostId = null;
            document.getElementById("formTitle").innerText = "Create Post";
            document.getElementById("postBtn").innerText = "Publish Post";
        } else {
            const { error } = await _supabase
                .from("posts")
                .insert([{
                    title,
                    description,
                    image_url: imageUrl,
                    user_id: currentUser.id,
                    user_name: authorName
                }]);

            if (error) throw error;

            Swal.fire("Published!", "Your post is live.", "success");
        }

        resetForm();
        fetchPosts();

    } catch (error) {
        Swal.fire("Error", error.message, "error");
    }
}

function resetForm() {
    document.getElementById("postForm").reset();
    const previewContainer = document.getElementById("imagePreviewContainer");
    if (previewContainer) previewContainer.classList.add("d-none");
    const uploadText = document.getElementById("uploadText");
    if (uploadText) uploadText.innerText = "Add Image";
}

async function fetchPosts() {
    const postsContainer = document.getElementById("posts");
    if (!postsContainer || !_supabase) return;

    postsContainer.innerHTML = '<div class="text-center text-secondary py-4"><i class="fa-solid fa-spinner fa-spin fs-3"></i></div>';

    try {
        const { data: posts, error } = await _supabase
            .from("posts")
            .select("*")
            .order("created_at", { ascending: false });

        if (error) throw error;

        postsContainer.innerHTML = "";

        if (!posts || posts.length === 0) {
            postsContainer.innerHTML = '<p class="text-secondary text-center py-4">No posts found.</p>';
            return;
        }

        for (const item of posts) {
            const card = document.createElement("div");
            card.className = "card post-card mb-4 shadow-lg";

            const isOwner = currentUser && currentUser.id === item.user_id;
            const authorDisplayName = item.user_name || (item.user_email ? item.user_email.split('@')[0] : "Anonymous");

            card.innerHTML = `
        <div class="card-header d-flex justify-content-between align-items-center py-2 px-3">
          <small class="text-info fw-bold"><i class="fa-solid fa-user me-1"></i>${authorDisplayName}</small>
          ${isOwner ? `
            <div>
              <button class="btn btn-sm text-info p-0 me-2" onclick="editPost('${item.id}', '${escapeQuotes(item.title)}', '${escapeQuotes(item.description)}')">
                <i class="fa-solid fa-pen-to-square"></i>
              </button>
              <button class="btn btn-sm text-danger p-0" onclick="deletePost('${item.id}')">
                <i class="fa-solid fa-trash"></i>
              </button>
            </div>
          ` : ""}
        </div>
        ${item.image_url ? `
          <div class="text-center bg-dark p-2">
            <img src="${item.image_url}" class="img-fluid rounded" style="max-height: 180px; object-fit: contain;" alt="Post image">
          </div>
        ` : ""}
        <div class="card-body">
          <h5 class="card-title post-title fw-bold text-info">${item.title}</h5>
          <p class="card-text post-body text-light">${item.description}</p>
          
          <div class="d-flex align-items-center mb-3">
            <button class="btn btn-sm btn-outline-danger me-2 heart-btn" onclick="toggleLike(this, '${item.id}')">
              <i class="fa-regular fa-heart me-1"></i><span class="like-text">Like</span>
            </button>
          </div>

          <div class="mt-3 pt-3 border-top border-secondary">
            <h6 class="small fw-bold text-secondary mb-2"><i class="fa-regular fa-comments me-1"></i> Comments</h6>
            
            <div id="comments-list-${item.id}" class="mb-3">
              <small class="text-muted d-block mb-1">Loading comments...</small>
            </div>

            <div class="input-group input-group-sm">
              <input type="text" id="comment-input-${item.id}" class="form-control bg-dark text-light border-secondary" placeholder="Write a comment...">
              <button class="btn btn-info fw-bold" onclick="addComment('${item.id}')">
                <i class="fa-solid fa-paper-plane"></i>
              </button>
            </div>
          </div>
        </div>
      `;

            postsContainer.appendChild(card);
            fetchComments(item.id);
        }

    } catch (error) {
        postsContainer.innerHTML = `<p class="text-danger">Failed to load posts: ${error.message}</p>`;
    }
}

function toggleLike(btn, postId) {
    const icon = btn.querySelector("i");
    const label = btn.querySelector(".like-text");

    if (icon.classList.contains("fa-regular")) {
        icon.classList.remove("fa-regular");
        icon.classList.add("fa-solid");
        btn.classList.remove("btn-outline-danger");
        btn.classList.add("btn-danger");
        if (label) label.innerText = "Liked";
    } else {
        icon.classList.remove("fa-solid");
        icon.classList.add("fa-regular");
        btn.classList.remove("btn-danger");
        btn.classList.add("btn-outline-danger");
        if (label) label.innerText = "Like";
    }
}

function escapeQuotes(str) {
    return (str || "").replace(/'/g, "\\'").replace(/"/g, '&quot;');
}

function editPost(id, title, description) {
    editPostId = id;
    document.getElementById("title").value = title;
    document.getElementById("description").value = description;

    document.getElementById("formTitle").innerText = "Edit Post";
    document.getElementById("postBtn").innerText = "Update Post";
    window.scrollTo({ top: 0, behavior: "smooth" });
}

async function deletePost(id) {
    const result = await Swal.fire({
        title: "Delete this post?",
        text: "This action cannot be undone.",
        icon: "warning",
        showCancelButton: true,
        confirmButtonColor: "#ef4444",
        confirmButtonText: "Delete"
    });

    if (result.isConfirmed) {
        try {
            const { error } = await _supabase.from("posts").delete().eq("id", id);
            if (error) throw error;
            Swal.fire("Deleted", "Post removed successfully.", "success");
            fetchPosts();
        } catch (error) {
            Swal.fire("Error", error.message, "error");
        }
    }
}

async function fetchComments(postId) {
    const commentsList = document.getElementById(`comments-list-${postId}`);
    if (!commentsList || !_supabase) return;

    try {
        const { data: comments, error } = await _supabase
            .from("comments")
            .select("*")
            .eq("post_id", postId)
            .order("created_at", { ascending: true });

        if (error) throw error;

        if (!comments || comments.length === 0) {
            commentsList.innerHTML = '<span class="text-muted small">No comments yet.</span>';
            return;
        }

        commentsList.innerHTML = comments.map(c => {
            const commenterName = c.author_name || c.user_name || (c.user_email ? c.user_email.split('@')[0] : 'Anonymous');
            return `
      <div class="comment-box p-2 mb-2">
        <div class="d-flex justify-content-between align-items-center">
          <strong class="text-info small" style="font-size: 11px;">${commenterName}</strong>
          <span class="text-muted" style="font-size: 10px;">${new Date(c.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
        </div>
        <p class="mb-0 text-light small">${c.comment_text || c.content || c.comment || ''}</p>
      </div>
    `;
        }).join("");

    } catch (error) {
        commentsList.innerHTML = `<span class="text-danger small">Error loading comments.</span>`;
    }
}

async function addComment(postId) {
    const input = document.getElementById(`comment-input-${postId}`);
    if (!input) return;
    const commentText = input.value.trim();

    if (!commentText) return;

    const authorName = getUserDisplayName(currentUser);

    try {
        const { error } = await _supabase
            .from("comments")
            .insert([{
                post_id: postId,
                user_id: currentUser.id,
                author_name: authorName,
                comment_text: commentText
            }]);

        if (error) throw error;

        input.value = "";
        fetchComments(postId);

    } catch (error) {
        Swal.fire("Error", error.message, "error");
    }
}

function searchPosts() {
    const query = document.getElementById("searchInput").value.toLowerCase();
    const posts = document.querySelectorAll(".post-card");

    posts.forEach((post) => {
        const title = post.querySelector(".post-title")?.innerText.toLowerCase() || "";
        const body = post.querySelector(".post-body")?.innerText.toLowerCase() || "";

        if (title.includes(query) || body.includes(query)) {
            post.parentElement.style.display = "block";
        } else {
            post.parentElement.style.display = "none";
        }
    });
}