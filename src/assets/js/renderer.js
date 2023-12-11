var datatable = false;

var tx = async (payload) => {   
    const data = await window.electronAPI.tx(payload);    
    return data;
}

window.electronAPI.handleRx((event, data) => {

    if (data.action == "innodb_buffer_pool_optimization") {
        const myModal = new bootstrap.Modal(document.getElementById('dataModal'));
        var sql = data.payload.sql;
        var format = window.sqlFormatter.format;

        var HTML = `<pre><code>`+format(sql)+`</code></pre><hr/>
        <div class="query_explain_div">
        <table class="table table-stripped">
            <thead>
                <th>#</th>
                <th>Recommended_InnoDB_Buffer_Pool_Size</th>
            </thead>
        <tbody>`;
        for ( var index in data.payload.results) {
            HTML += `<tr>
                <td>`+index+`</td>
                <td>`+data.payload.results[index].Recommended_InnoDB_Buffer_Pool_Size+`</td>                
            </tr>`;
        }
            HTML += `</tbody>
        </table></div>
        `;
        $('#dataModalBody').html(HTML);
        
        myModal.show();
    }

    if (data.action == "explain_query") {
        const myModal = new bootstrap.Modal(document.getElementById('explainModal'));
        
        var sql = data.payload.sql;
        var format = window.sqlFormatter.format;

        var HTML = `<pre><code>`+format(sql)+`</code></pre><hr/>
        <div class="query_explain_div">
        <table class="table table-stripped">
            <thead>
                <th>id</th>
                <th>select_type</th>
                <th>table</th>
                <th>type</th>
                <th>possible_keys</th>
                <th>key</th>
                <th>key_len</th>
                <th>ref</th>
                <th>rows</th>
                <th>Extra</th>                
            </thead>
            <tbody>`;
        for ( var index in data.payload.results) {
            HTML += `<tr>
                <td>`+data.payload.results[index].id+`</td>
                <td>`+data.payload.results[index].select_type+`</td>
                <td>`+data.payload.results[index].table+`</td>
                <td>`+data.payload.results[index].type+`</td>
                <td>`+data.payload.results[index].possible_keys+`</td>
                <td>`+data.payload.results[index].key+`</td>
                <td>`+data.payload.results[index].key_len+`</td>
                <td>`+data.payload.results[index].ref+`</td>
                <td>`+data.payload.results[index].rows+`</td>
                <td>`+data.payload.results[index].Extra+`</td>
            </tr>`;
        }
            HTML += `</tbody>
        </table></div>
        `;
        $('#explainModalBody').html(HTML);
        
        myModal.show();
    }

    if (data.action == "update_profiling_tbody") {
        for ( var index in data.payload ) {

            var HTML = `<tr>
                <td>`+data.payload[index].start_time+`</td>
                <td>`+data.payload[index].user_host+`</td>
                <td>`+data.payload[index].db+`</td>
                <td>`+data.payload[index].query_time+`</td>
                <td>`+data.payload[index].sql_text.slice(0, 50) + "[...]"+`</td>
                <td>
                `;
                if (data.payload[index].sql_text.startsWith("SELECT ")) {
                    HTML += `<button type="button" id="explainModal_btn" class="btn btn-sm btn-secondary" data-sql="`+btoa(data.payload[index].sql_text)+`">Explain</button>`;
                }
                HTML += `</td>
            </tr>`;

            datatable.row.add($(HTML));

        }

        datatable
            .column( '3:visible' )
            .order( 'desc' )
            .draw();
    }

    if (data.action == "start_profiling") {        
        var databases_start_profiling_btn = document.getElementById('databases_start_profiling_btn');
        if (databases_start_profiling_btn) {
            databases_start_profiling_btn.style.display = 'none';
        }        
        var databases_stop_profiling_btn = document.getElementById('databases_stop_profiling_btn');
        if (databases_stop_profiling_btn) {
            databases_stop_profiling_btn.style.display = 'inline';
        }        
    }

    if (data.action == "stop_profiling") {        
        var databases_start_profiling_btn = document.getElementById('databases_start_profiling_btn');
        if (databases_start_profiling_btn) {
            databases_start_profiling_btn.style.display = 'inline';
        }        
        var databases_stop_profiling_btn = document.getElementById('databases_stop_profiling_btn');
        if (databases_stop_profiling_btn) {
            databases_stop_profiling_btn.style.display = 'none';
        }        
    }

    if (data.action == "connect_database") {
        if (!data.payload.database_connected) {
            alert('Unable to connect to database server.');
        }
    }

    if (data.action == "get_databases") {
        var databases = data.payload;
        var HTML='';
        for (var index in databases) {
            HTML += `<tr>
                        <td>`+databases[index].name+`</td>
                        <td>`+databases[index].hostname+`:`+databases[index].port+`</td>
                        <td>`+databases[index].database+`</td>
                        <td>`+databases[index].username+`</td>                        
                        <td align="right">
                            <button data-id="`+databases[index].id+`" id="databases_delete_btn" type="button" class="btn btn-danger btn-sm">Delete</button>
                            <button data-id="`+databases[index].id+`" id="databases_connect_btn" type="button" class="btn btn-info btn-sm">Connect</button>
                        </td>
                    </tr>`;
        }
        databases_manage_tbody.innerHTML = HTML;
    }

    // event.sender.send('counter-value', newValue)
});

const databases_add_save_btn = document.getElementById('databases_add_save_btn');
if (databases_add_save_btn) {
    databases_add_save_btn.addEventListener('click', () => {
        
        const databases_add_input_name = document.getElementById('databases_add_input_name').value;
        const databases_add_input_hostname = document.getElementById('databases_add_input_hostname').value;
        const databases_add_input_port = document.getElementById('databases_add_input_port').value;
        const databases_add_input_username = document.getElementById('databases_add_input_username').value;
        const databases_add_input_password = document.getElementById('databases_add_input_password').value;
        const databases_add_input_database = document.getElementById('databases_add_input_database').value;

        tx({
            'action': 'store_database_info',
            'db_name': databases_add_input_name,
            'db_hostname': databases_add_input_hostname,
            'db_port': databases_add_input_port,
            'db_username': databases_add_input_username,
            'db_password': databases_add_input_password,
            'db_database': databases_add_input_database,
        });  

        tx({
            'action': 'navigate',
            'page': 'menu_databases_manage'
        });  
    });   
}

const databases_stop_profiling_btn = document.getElementById('databases_stop_profiling_btn');
if (databases_stop_profiling_btn) {
    databases_stop_profiling_btn.addEventListener('click', () => {
        tx({
            'action': 'stop_profiling'
        });  
    });   
}

const databases_start_profiling_btn = document.getElementById('databases_start_profiling_btn');
if (databases_start_profiling_btn) {
    databases_start_profiling_btn.addEventListener('click', () => {
        tx({
            'action': 'start_profiling'
        });  
    });   
}

const databases_add_btn = document.getElementById('databases_add_btn');
if (databases_add_btn) {
    databases_add_btn.addEventListener('click', () => {
        tx({
            'action': 'navigate',
            'page': 'menu_databases_add'
        });  
    });   
}

document.body.addEventListener( 'click', function ( event ) {
    if( event.target.id == 'databases_connect_btn' ) {
        var data_id = event.target.getAttribute('data-id');

        tx({
            'action': 'connect_database',
            'id': data_id
        });       

    }

    if( event.target.id == 'databases_delete_btn' ) {
        if (confirm('Are you sure?')) {
            var data_id = event.target.getAttribute('data-id');
            tx({
                'action': 'store_database_delete',
                'id': data_id
            });
            
            tx({
                'action': 'navigate',
                'page': 'menu_databases_manage'
            });  
        }
    };
} );

const databases_clear_profiling_btn = document.getElementById('databases_clear_profiling_btn');
if (databases_clear_profiling_btn) {
    databases_clear_profiling_btn.addEventListener('click', () => {
        datatable.clear().draw();
    });
}

const databases_manage_tbody = document.getElementById('databases_manage_tbody');
if (databases_manage_tbody) {
    tx({
        'action': 'get_databases'
    });   
}

const missing_index_scanner_btn = document.getElementById('missing_index_scanner_btn');
if (missing_index_scanner_btn) {
    missing_index_scanner_btn.addEventListener('click', () => {
        tx({
            'action': 'missing_index_scanner',
        });  
    });
}

const databases_innodb_buffer_pool_size_optimize_btn = document.getElementById('databases_innodb_buffer_pool_size_optimize_btn');
if (databases_innodb_buffer_pool_size_optimize_btn) {
    databases_innodb_buffer_pool_size_optimize_btn.addEventListener('click', () => {
        tx({
            'action': 'innodb_buffer_pool_optimization',
        });  
    });
}

const menu_databases_manage = document.getElementById('menu_databases_manage');
if (menu_databases_manage) {
    menu_databases_manage.addEventListener('click', () => {
        tx({
            'action': 'navigate',
            'page': 'menu_databases_manage'
        });  
    });
}

$(function() {
    datatable = $('#datatable').DataTable();    
    $(document).on('click', '#explainModal_btn', function() {
        var dataSql = $(this).attr('data-sql');
        var sql = atob(dataSql);
        tx({
            'action': 'explain_query',
            'sql': sql
        });  
    });
});