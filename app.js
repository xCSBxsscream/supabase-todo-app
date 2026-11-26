/* ============================================================================
 * ไฟล์: 03_complete_auth_rls/app.js
 * วัตถุประสงค์: ระบบจัดการงานฉบับสมบูรณ์ รองรับ Auth + RLS + Search + Storage
 * ============================================================================ */

// ----------------------------------------------------------------------------
// 1. ตั้งค่าการเชื่อมต่อ Supabase (เปลี่ยนเป็น Project URL และ Publishable Key ของตนเอง)
//    - SUPABASE_URL: หาได้จาก Project Overview หรือ Project Settings > Data API
//    - SUPABASE_ANON_KEY: หาได้จาก Project Settings > API Keys (ใช้ช่อง Publishable key: sb_publishable_...)
// ----------------------------------------------------------------------------
const SUPABASE_URL = 'https://sxwkfvbowzysjnfefcqs.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_cx81EPkjdGONKLr_xVhj8A_1y_Ry-WN';
const STORAGE_BUCKET = 'todo-images'; // ชื่อ Bucket ใน Supabase Storage (ตอนที่ 5)

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let currentUser = null;

// ----------------------------------------------------------------------------
// 2. อ้างอิง DOM Elements
// ----------------------------------------------------------------------------
const authSection      = document.getElementById('authSection');
const appSection       = document.getElementById('appSection');
const emailInput       = document.getElementById('emailInput');
const passwordInput    = document.getElementById('passwordInput');
const loginBtn         = document.getElementById('loginBtn');
const signupBtn        = document.getElementById('signupBtn');
const authMessage      = document.getElementById('authMessage');
const userEmailDisplay = document.getElementById('userEmailDisplay');
const logoutBtn        = document.getElementById('logoutBtn');

const todoForm       = document.getElementById('todoForm');
const todoTitle      = document.getElementById('todoTitle');
const todoCategory   = document.getElementById('todoCategory');
const todoImage      = document.getElementById('todoImage');
const submitTodoBtn  = document.getElementById('submitTodoBtn');
const searchInput    = document.getElementById('searchInput');
const filterCategory = document.getElementById('filterCategory');
const todoList       = document.getElementById('todoList');
const todoCount      = document.getElementById('todoCount');
const refreshBtn     = document.getElementById('refreshBtn');

function showAuthMessage(text, isError = false) {
  authMessage.textContent = text;
  authMessage.style.color = isError ? '#dc2626' : '#166534';
}

// ----------------------------------------------------------------------------
// 3. ระบบสมาชิก (Authentication: Sign Up, Sign In, Sign Out)
// ----------------------------------------------------------------------------
async function handleSignUp() {
  const email = emailInput.value.trim();
  const password = passwordInput.value;

  if (!email || password.length < 6) {
    showAuthMessage('กรุณากรอกอีเมลและรหัสผ่านอย่างน้อย 6 ตัวอักษร', true);
    return;
  }

  showAuthMessage('กำลังสมัครสมาชิก...');
  const { data, error } = await supabaseClient.auth.signUp({ email, password });

  if (error) {
    showAuthMessage(`สมัครสมาชิกไม่สำเร็จ: ${error.message}`, true);
    return;
  }

  if (data.session) {
    showAuthMessage('สมัครสมาชิกและเข้าสู่ระบบสำเร็จ!');
  } else {
    showAuthMessage('สมัครสำเร็จ! กรุณาตรวจสอบอีเมลเพื่อยืนยันบัญชี หรือปิด Confirm Email ใน Dashboard');
  }
}

async function handleSignIn() {
  const email = emailInput.value.trim();
  const password = passwordInput.value;

  if (!email || !password) {
    showAuthMessage('กรุณากรอกอีเมลและรหัสผ่านให้ครบถ้วน', true);
    return;
  }

  showAuthMessage('กำลังเข้าสู่ระบบ...');
  const { error } = await supabaseClient.auth.signInWithPassword({ email, password });

  if (error) {
    showAuthMessage(`เข้าสู่ระบบไม่สำเร็จ: ${error.message}`, true);
    return;
  }
  showAuthMessage('');
}

async function handleSignOut() {
  await supabaseClient.auth.signOut();
}

function updateUIForUser(user) {
  currentUser = user;
  if (user) {
    authSection.classList.add('hidden');
    appSection.classList.remove('hidden');
    userEmailDisplay.textContent = user.email;
    fetchTodos();
  } else {
    authSection.classList.remove('hidden');
    appSection.classList.add('hidden');
    todoList.innerHTML = '';
  }
}

// ----------------------------------------------------------------------------
// 4. [READ + FILTER + SEARCH] ดึงข้อมูลพร้อมรองรับการค้นหา (.ilike) และกรองหมวดหมู่ (.eq)
// ----------------------------------------------------------------------------
async function fetchTodos() {
  if (!currentUser) return;

  let query = supabaseClient
    .from('todos')
    .select('*')
    .order('created_at', { ascending: false });

  const keyword = searchInput.value.trim();
  if (keyword) {
    query = query.ilike('title', `%${keyword}%`);
  }

  const selectedCat = filterCategory.value;
  if (selectedCat !== 'ALL') {
    query = query.eq('category', selectedCat);
  }

  const { data, error } = await query;

  if (error) {
    console.error('ดึงข้อมูลผิดพลาด:', error);
    alert(`ไม่สามารถดึงข้อมูลได้: ${error.message}`);
    return;
  }

  renderTodos(data);
}

function renderTodos(todos) {
  todoCount.textContent = todos.length;
  todoList.innerHTML = '';

  if (todos.length === 0) {
    todoList.innerHTML = '<li class="empty-state">ไม่พบรายการงานของคุณ</li>';
    return;
  }

  todos.forEach((todo) => {
    const li = document.createElement('li');
    li.className = `todo-item ${todo.is_complete ? 'completed' : ''}`;

    const leftDiv = document.createElement('div');
    leftDiv.className = 'todo-left';

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.className = 'todo-checkbox';
    checkbox.checked = todo.is_complete;
    checkbox.addEventListener('change', () => toggleTodoStatus(todo.id, checkbox.checked));

    const contentDiv = document.createElement('div');
    contentDiv.className = 'todo-content';

    const titleRow = document.createElement('div');
    const titleSpan = document.createElement('span');
    titleSpan.className = 'todo-title';
    titleSpan.textContent = todo.title;

    const catBadge = document.createElement('span');
    catBadge.className = 'todo-meta';
    catBadge.textContent = todo.category || 'ทั่วไป';

    titleRow.append(titleSpan, catBadge);
    contentDiv.appendChild(titleRow);

    if (todo.image_url) {
      const img = document.createElement('img');
      img.src = todo.image_url;
      img.alt = todo.title;
      img.className = 'todo-thumb';
      contentDiv.appendChild(img);
    }

    leftDiv.append(checkbox, contentDiv);

    const actionsDiv = document.createElement('div');
    actionsDiv.className = 'todo-actions';

    const editBtn = document.createElement('button');
    editBtn.className = 'btn btn-edit';
    editBtn.textContent = 'แก้ไข';
    editBtn.addEventListener('click', () => editTodoTitle(todo.id, todo.title));

    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'btn btn-delete';
    deleteBtn.textContent = 'ลบ';
    deleteBtn.addEventListener('click', () => deleteTodo(todo.id));

    actionsDiv.append(editBtn, deleteBtn);
    li.append(leftDiv, actionsDiv);
    todoList.appendChild(li);
  });
}

// ----------------------------------------------------------------------------
// 5. [STORAGE + CREATE] อัปโหลดรูป (ถ้ามี) แล้วบันทึกข้อมูลพร้อม user_id ของตนเอง
// ----------------------------------------------------------------------------
async function uploadImageIfSelected(file) {
  if (!file) return null;

  const fileExt = file.name.split('.').pop();
  const filePath = `${currentUser.id}/${Date.now()}.${fileExt}`;

  const { error: uploadError } = await supabaseClient.storage
    .from(STORAGE_BUCKET)
    .upload(filePath, file);

  if (uploadError) {
    throw new Error(`อัปโหลดรูปไม่สำเร็จ (ตรวจสอบ Bucket '${STORAGE_BUCKET}' และ Storage Policy): ${uploadError.message}`);
  }

  const { data } = supabaseClient.storage
    .from(STORAGE_BUCKET)
    .getPublicUrl(filePath);

  return data.publicUrl;
}

async function addTodo(event) {
  event.preventDefault();
  if (!currentUser) return;

  const title = todoTitle.value.trim();
  if (!title) return;

  submitTodoBtn.disabled = true;
  submitTodoBtn.textContent = 'กำลังบันทึก...';

  try {
    const file = todoImage.files[0];
    const imageUrl = await uploadImageIfSelected(file);

    const { error } = await supabaseClient
      .from('todos')
      .insert([
        {
          title: title,
          category: todoCategory.value,
          is_complete: false,
          image_url: imageUrl,
          user_id: currentUser.id
        }
      ]);

    if (error) throw error;

    todoTitle.value = '';
    todoImage.value = '';
    await fetchTodos();
  } catch (err) {
    console.error(err);
    alert(err.message);
  } finally {
    submitTodoBtn.disabled = false;
    submitTodoBtn.textContent = '+ บันทึกงาน';
  }
}

// ----------------------------------------------------------------------------
// 6. [UPDATE & DELETE] แก้ไขและลบข้อมูล
// ----------------------------------------------------------------------------
async function toggleTodoStatus(id, isComplete) {
  const { error } = await supabaseClient
    .from('todos')
    .update({ is_complete: isComplete })
    .eq('id', id);

  if (error) alert(`อัปเดตไม่สำเร็จ: ${error.message}`);
  else await fetchTodos();
}

async function editTodoTitle(id, currentTitle) {
  const newTitle = prompt('แก้ไขชื่องาน:', currentTitle);
  if (newTitle === null || newTitle.trim() === '') return;

  const { error } = await supabaseClient
    .from('todos')
    .update({ title: newTitle.trim() })
    .eq('id', id);

  if (error) alert(`แก้ไขไม่สำเร็จ: ${error.message}`);
  else await fetchTodos();
}

async function deleteTodo(id) {
  if (!confirm('ยืนยันการลบรายการงานนี้?')) return;

  const { error } = await supabaseClient
    .from('todos')
    .delete()
    .eq('id', id);

  if (error) alert(`ลบไม่สำเร็จ: ${error.message}`);
  else await fetchTodos();
}

// ----------------------------------------------------------------------------
// 7. ผูก Event Listeners และติดตามสถานะการล็อกอินแบบอัตโนมัติ
// ----------------------------------------------------------------------------
signupBtn.addEventListener('click', handleSignUp);
loginBtn.addEventListener('click', handleSignIn);
logoutBtn.addEventListener('click', handleSignOut);
todoForm.addEventListener('submit', addTodo);
refreshBtn.addEventListener('click', fetchTodos);
searchInput.addEventListener('input', fetchTodos);
filterCategory.addEventListener('change', fetchTodos);

supabaseClient.auth.onAuthStateChange((_event, session) => {
  updateUIForUser(session?.user ?? null);
});
