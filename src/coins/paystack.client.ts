import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance } from 'axios';

export interface InitializeTransactionResult {
  authorizationUrl: string;
  accessCode: string;
  reference: string;
}

export interface VerifyTransactionResult {
  status: 'success' | 'failed' | 'abandoned';
  reference: string;
  amount: number;
}

// Paystack has no maintained official Node SDK, so this is a thin wrapper over its REST API.
@Injectable()
export class PaystackClient {
  private readonly http: AxiosInstance;

  constructor(private readonly configService: ConfigService) {
    this.http = axios.create({
      baseURL: 'https://api.paystack.co',
      headers: {
        Authorization: `Bearer ${this.configService.get('PAYSTACK_SECRET_KEY')}`,
      },
    });
  }

  async initializeTransaction(
    email: string,
    amountKobo: number,
    reference: string,
  ): Promise<InitializeTransactionResult> {
    const { data } = await this.http.post('/transaction/initialize', {
      email,
      amount: amountKobo,
      reference,
    });

    return {
      authorizationUrl: data.data.authorization_url,
      accessCode: data.data.access_code,
      reference: data.data.reference,
    };
  }

  async verifyTransaction(reference: string): Promise<VerifyTransactionResult> {
    const { data } = await this.http.get(`/transaction/verify/${reference}`);
    return {
      status: data.data.status,
      reference: data.data.reference,
      amount: data.data.amount,
    };
  }
}
