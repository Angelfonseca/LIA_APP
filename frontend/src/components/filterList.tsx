import React, { useEffect, useState } from 'react';
import { Filter } from '../types';
import apiService from '../services/api.service';
import '../assets/css/componentsCss/filterList.css';

const FilterList: React.FC = () => {
    const [filters, setFilters] = useState<Filter[]>([]);
    const [devices, setDevices] = useState<{ [key: string]: string }>({});
    const [modules, setModules] = useState<{ [key: string]: string }>({});

    useEffect(() => {
        const fetchFilters = async () => {
            try {
                const data = await apiService.get<Filter[]>('/filters/getall');
                setFilters(data);

                const devicePromises = data.map(filter =>
                    apiService.get<{ name: string }>(`/devices/byid/${filter.device}`)
                );
                const modulePromises = data.map(filter =>
                    apiService.get<{ name: string }>(`/modules/${filter.module}`)
                );

                const deviceResults = await Promise.all(devicePromises);
                const moduleResults = await Promise.all(modulePromises);

                const devicesMap: { [key: string]: string } = {};
                const modulesMap: { [key: string]: string } = {};

                deviceResults.forEach((result, index) => {
                    devicesMap[data[index].device] = result.name;
                });

                moduleResults.forEach((result, index) => {
                    modulesMap[data[index].module] = result.name;
                });

                setDevices(devicesMap);
                setModules(modulesMap);
            } catch (error) {
                console.error('Error al obtener datos:', error);
            }
        };

        fetchFilters();
    }, []);

    const handleDelete = async (id: string) => {
        try {
            await apiService.delete(`/filters/delete/${id}`);
            setFilters(filters.filter(filter => filter._id !== id));
        } catch (error) {
            console.error('Error al eliminar filtro:', error);
        }
    };

    return (
        <div>
            <h3>Gestionar Filtros</h3>
            <table>
                <thead>
                    <tr>
                        <th>Dispositivo</th>
                        <th>Modulo</th>
                        <th>Campo</th>
                        <th>Condiciones</th>
                        <th>Acciones</th>
                    </tr>
                </thead>
                <tbody>
                    {filters.map(filter => (
                        <tr key={filter._id}>
                            <td>{devices[filter.device] || 'Cargando...'}</td>
                            <td>{modules[filter.module] || 'Cargando...'}</td>
                            <td>{filter.field}</td>
                            <td>
                                {filter.conditions.map((cond, i) => (
                                    <div key={i}>
                                        Condition: {cond.condition}, Threshold: {cond.threshold}
                                    </div>
                                ))}
                            </td>
                            <td>
                                <button onClick={() => handleDelete(filter._id)}>Eliminar</button>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
};

export default FilterList;
