$(document).ready(function() {
    $('.btn-upload').on('click', function() {
        var btn = $(this);
        var glossaryType = btn.data('type');
        var card = btn.closest('.glossary-card');
        var fileInput = card.find('.glossary-file-input');
        var statusEl = $('#status-' + glossaryType);

        if (!fileInput[0].files.length) {
            showStatus(statusEl, 'danger', 'Please select a file first.');
            return;
        }

        var formData = new FormData();
        formData.append('file', fileInput[0].files[0]);

        btn.prop('disabled', true);
        btn.html('<span class="spinner-border spinner-border-sm"></span> Uploading...');
        statusEl.addClass('d-none');

        $.ajax({
            url: '/api/glossary/' + glossaryType + '/upload',
            type: 'POST',
            data: formData,
            processData: false,
            contentType: false,
            success: function(data) {
                card.find('.entry-count').text(data.count);
                card.find('.last-uploaded').text(data.last_uploaded_at);

                // Update or add filename row
                var filenameEl = card.find('.original-filename');
                if (filenameEl.length) {
                    filenameEl.text(data.original_filename).attr('title', data.original_filename);
                } else {
                    var statsBlock = card.find('.glossary-card-stats');
                    statsBlock.append(
                        '<div class="stat-row">' +
                            '<span class="stat-label">File</span>' +
                            '<span class="stat-value original-filename text-truncate" title="' + data.original_filename + '">' + data.original_filename + '</span>' +
                        '</div>'
                    );
                }

                showStatus(statusEl, 'success', 'Updated successfully — ' + data.count + ' entries loaded.');
                fileInput.val('');

                // Auto-hide success message after 5 seconds
                setTimeout(function() {
                    statusEl.fadeOut(300, function() {
                        $(this).addClass('d-none').show();
                    });
                }, 5000);
            },
            error: function(xhr) {
                var msg = 'Upload failed.';
                if (xhr.responseJSON && xhr.responseJSON.error) {
                    msg = xhr.responseJSON.error;
                }
                showStatus(statusEl, 'danger', msg);
            },
            complete: function() {
                btn.prop('disabled', false);
                btn.html('<i class="bi bi-cloud-arrow-up"></i> Upload');
            }
        });
    });
});

function showStatus(el, type, message) {
    el.removeClass('d-none alert-success alert-danger')
      .addClass('alert alert-' + type)
      .text(message);
}
