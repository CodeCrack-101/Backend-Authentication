document.querySelectorAll('.edit-btn').forEach(button => {
    button.addEventListener('click', () => {
      const postDiv = button.closest('.post');
      const form = postDiv.querySelector('.edit-form');
      form.style.display = 'block';
      button.style.display = 'none';
    });
  });

  document.querySelectorAll('.cancel-edit').forEach(button => {
    button.addEventListener('click', () => {
      const form = button.closest('.edit-form');
      form.style.display = 'none';
      const postDiv = button.closest('.post');
      const editBtn = postDiv.querySelector('.edit-btn');
      editBtn.style.display = 'inline-block';
    });
  });