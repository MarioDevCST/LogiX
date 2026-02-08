import DataTable from '../components/DataTable.jsx'

export default function Routes() {
  const columns = [
    { key: 'name', header: 'Ruta' },
    { key: 'stops', header: 'Paradas' },
    { key: 'status', header: 'Estado' },
    { key: 'vehicle', header: 'Vehículo' },
  ]
  const data = [
    { name: 'Ruta Norte', stops: 12, status: 'Planificada', vehicle: 'VAN-23' },
    { name: 'Ruta Centro', stops: 8, status: 'En curso', vehicle: 'TRK-12' },
    { name: 'Ruta Sur', stops: 15, status: 'Completada', vehicle: 'VAN-07' },
  ]

  const onCreate = () => {
    alert('Crear ruta')
  }

  return (
    <DataTable
      title="Rutas"
      columns={columns}
      data={data}
      createLabel="Crear ruta"
      onCreate={onCreate}
    />
  )
}