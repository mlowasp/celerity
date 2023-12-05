var datatable = false;

var tx = async (payload) => {   
    const data = await window.electronAPI.tx(payload);    
    return data;
}

window.electronAPI.handleRx((event, data) => {

    if (data.action == "update_profiling_tbody") {
        for ( var index in data.payload ) {
            
            var row = [
                data.payload[index].start_time,
                data.payload[index].user_host,
                data.payload[index].db,
                data.payload[index].query_time,
                data.payload[index].sql_text.slice(0, 50) + "[...]",
            ];    
            
            datatable.row.add(row);

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
});