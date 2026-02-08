import DataTable from '../components/DataTable.jsx'

export default function Orders() {
  const columns = [
    { key: 'number', header: 'Número' },
    { key: 'customer', header: 'Cliente' },
    { key: 'status', header: 'Estado' },
    { key: 'scheduled', header: 'Programado' },
  ]
  const data = [
    { number: 'PO-1001', customer: 'ACME Corp', status: 'Pendiente', scheduled: '2026-02-03' },
    { number: 'PO-1002', customer: 'Globex', status: 'En ruta', scheduled: '2026-02-04' },
    { number: 'PO-1003', customer: 'Initech', status: 'Entregado', scheduled: '2026-02-01' },
  ]

  const onCreate = () => {
    // TODO: abrir modal de creación o navegar a formulario
    alert('Crear pedido')
  }

  return (
    <DataTable
      title="Pedidos"
      columns={columns}
      data={data}
      createLabel="Crear pedido"
      onCreate={onCreate}
    />
  )
}