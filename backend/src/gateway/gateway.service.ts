import { HttpService } from '@nestjs/axios';
import { Injectable, NotFoundException } from '@nestjs/common';
import { firstValueFrom } from 'rxjs';
import { CreateServiceDto } from './dto/create-service.dto';
import { UpdateServiceDto } from './dto/update-service.dto';

@Injectable()
export class GatewayService {
  private readonly baseUrl: string;

  constructor(private readonly http: HttpService) {
    this.baseUrl = process.env.GATEWAY_URL ?? 'http://localhost:5555';
  }

  async findAll() {
    const { data } = await firstValueFrom(
      this.http.get(`${this.baseUrl}/admin/services`),
    );
    return data;
  }

  async findOne(name: string) {
    try {
      const { data } = await firstValueFrom(
        this.http.get(`${this.baseUrl}/admin/services/${name}`),
      );
      return data;
    } catch (err: any) {
      if (err.response?.status === 404) throw new NotFoundException(`Service "${name}" not found`);
      throw err;
    }
  }

  async create(dto: CreateServiceDto) {
    const { data } = await firstValueFrom(
      this.http.post(`${this.baseUrl}/admin/services`, dto),
    );
    return data;
  }

  async update(name: string, dto: UpdateServiceDto) {
    try {
      const { data } = await firstValueFrom(
        this.http.put(`${this.baseUrl}/admin/services/${name}`, dto),
      );
      return data;
    } catch (err: any) {
      if (err.response?.status === 404) throw new NotFoundException(`Service "${name}" not found`);
      throw err;
    }
  }

  async remove(name: string) {
    try {
      await firstValueFrom(
        this.http.delete(`${this.baseUrl}/admin/services/${name}`),
      );
    } catch (err: any) {
      if (err.response?.status === 404) throw new NotFoundException(`Service "${name}" not found`);
      throw err;
    }
  }

  async getLogs(name: string) {
    try {
      const { data } = await firstValueFrom(
        this.http.get(`${this.baseUrl}/admin/services/${name}/logs`),
      );
      return data;
    } catch (err: any) {
      if (err.response?.status === 404) throw new NotFoundException(`Service "${name}" not found`);
      throw err;
    }
  }
}
