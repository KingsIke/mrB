import { BadRequestException, Injectable } from '@nestjs/common';
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

  // Inside your PaystackClient class
async resolveAccountNumber(accountNumber: string, bankCode: string): Promise<{ account_name: string; account_number: string }> {
  try {
    const response = await this.http.get('/bank/resolve', {
      params: {
        account_number: accountNumber,
        bank_code: bankCode,
      },
    });

    if (!response.data?.status || !response.data?.data) {
      throw new BadRequestException('Could not resolve account details');
    }

    return response.data.data; // Returns { account_name, account_number, bank_id }
  } catch (error: any) {
    throw new BadRequestException(
      error.response?.data?.message || 'Failed to verify account holder name',
    );
  }
}
}
