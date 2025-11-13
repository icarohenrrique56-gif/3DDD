import { 
    Component, 
    ChangeDetectionStrategy, 
    inject, 
    signal, 
    computed,
    OnInit,
    OnDestroy,
    CUSTOM_ELEMENTS_SCHEMA
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { 
    ReactiveFormsModule, 
    FormBuilder, 
    Validators, 
    FormGroup 
} from '@angular/forms';
import { Subject, takeUntil } from 'rxjs';

// Importações do Firebase
import { initializeApp, FirebaseApp } from "firebase/app";
import { 
    getAuth, 
    Auth,
    signInAnonymously, 
    signInWithCustomToken, 
    onAuthStateChanged, 
    User,
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
    signOut
} from "firebase/auth";
import { 
    getFirestore, 
    Firestore,
    collection, 
    addDoc, 
    onSnapshot, 
    doc, 
    updateDoc, 
    serverTimestamp,
    query,
    where, // <-- IMPORTANTE: Adicionado para filtrar pedidos do usuário
    setLogLevel
} from "firebase/firestore";

// --- Configuração do Firebase (REAL - Fornecida pelo usuário) ---
const firebaseConfig = {
  apiKey: "AIzaSyAe5vcJe5mUUxAX5mXWFjCwL26esbxLvbo",
  authDomain: "projeto-p-c672e.firebaseapp.com",
  databaseURL: "https://projeto-p-c672e-default-rtdb.firebaseio.com",
  projectId: "projeto-p-c672e",
  storageBucket: "projeto-p-c672e.firebasestorage.app",
  messagingSenderId: "474078684255",
  appId: "1:474078684255:web:78313a16cab4e501e0a7ea",
  measurementId: "G-DX6WX55RB8"
};

// As variáveis de ambiente não são mais necessárias
const appId = 'default-app-id'; // Usado no caminho da coleção
const initialAuthToken = null; // Não usado no login real
const COLLECTION_NAME = 'pedidos_impressao_3d';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  schemas: [CUSTOM_ELEMENTS_SCHEMA], // <-- CORREÇÃO: Adicionado para permitir o 'ion-icon'
  template: `
    <!-- Barra de Header Global -->
    <div class="bg-white shadow-md">
      <div class="container mx-auto max-w-7xl p-4 md:p-6 flex items-center justify-between space-x-4">
        <div class="flex items-center space-x-4">
            <ion-icon name="cube-outline" class="text-4xl text-indigo-600"></ion-icon>
            <div>
                <h1 class="text-3xl font-bold text-gray-900">Gerenciador de Fila de Impressão 3D</h1>
                <p class="text-gray-600">Dashboard de gerenciamento de pedidos em tempo real.</p>
            </div>
        </div>
        @if (authReady() && currentPage() !== 'login') {
          <button (click)="handleLogout()" class="flex items-center space-x-2 text-sm font-medium text-gray-600 hover:text-indigo-600 transition-colors">
            <ion-icon name="log-out-outline" class="text-lg"></ion-icon>
            <span>Sair ({{ userRole() }})</span>
          </button>
        }
      </div>
    </div>

    <!-- Container Principal -->
    <div class="container mx-auto max-w-7xl p-4 md:p-6">
      
      <!-- Indicador de Carregamento de Autenticação -->
      @if (!authReady()) {
        <div class="flex flex-col items-center justify-center text-center text-gray-500 py-20">
          <svg class="animate-spin h-10 w-10 text-indigo-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <p class="mt-3 text-lg">Autenticando...</p>
        </div>
      }

      <!-- Renderização de Página (View) -->
      @if (authReady()) {
        @switch (currentPage()) {
          
          <!-- PÁGINA DE LOGIN -->
          @case ('login') {
            <div class="max-w-md mx-auto mt-10 bg-white p-8 rounded-lg shadow-xl">
              <h2 class="text-2xl font-semibold text-center mb-6">Acessar Sistema</h2>
              <form [formGroup]="loginForm" (ngSubmit)="handleLogin()" class="space-y-4">
                <div>
                  <label for="email" class="block text-sm font-medium text-gray-600">E-mail</label>
                  <input type="email" id="email" formControlName="email" 
                         class="mt-1 block w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                         [class.border-gray-300]="!isInvalid('email', loginForm)"
                         [class.border-red-500]="isInvalid('email', loginForm)"
                         required>
                  @if (isInvalid('email', loginForm)) {
                    <p class="mt-1 text-xs text-red-600">Por favor, insira um e-mail válido.</p>
                  }
                </div>
                <div>
                  <label for="password" class="block text-sm font-medium text-gray-600">Senha</label>
                  <input type="password" id="password" formControlName="password" 
                         class="mt-1 block w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500" 
                         [class.border-gray-300]="!isInvalid('password', loginForm)"
                         [class.border-red-500]="isInvalid('password', loginForm)"
                         required>
                  @if (isInvalid('password', loginForm)) {
                    <p class="mt-1 text-xs text-red-600">A senha é obrigatória (mín. 6 caracteres).</p>
                  }
                </div>
                
                @if (loginError()) {
                  <p class="text-sm text-red-600">{{ loginError() }}</p>
                }

                <div class="text-xs text-gray-500 text-center pt-2">
                    <p>Use <strong>admin@app.com</strong> / <strong>123456</strong> para login de Admin.</p>
                    <p>Use qualquer outro e-mail / senha para login de Usuário (será criado se não existir).</p>
                </div>

                <button type="submit" [disabled]="loginForm.invalid || isLoggingIn()" class="w-full flex items-center justify-center py-3 px-4 border border-transparent rounded-lg shadow-sm text-base font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition duration-150 ease-in-out disabled:opacity-50 disabled:cursor-not-allowed">
                  @if (isLoggingIn()) {
                    <svg class="animate-spin h-5 w-5 mr-3 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                      <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <span>Entrando...</span>
                  } @else {
                    <ion-icon name="log-in-outline" class="mr-2 text-lg"></ion-icon>
                    <span>Entrar</span>
                  }
                </button>
              </form>
            </div>
          }

          <!-- PÁGINA DO USUÁRIO (Formulário e Histórico) -->
          @case ('user') {
            <!-- Grid 2 colunas: Formulário à esquerda, Histórico à direita -->
            <div class="grid grid-cols-1 lg:grid-cols-2 gap-8">
              
              <!-- Coluna 1: Formulário -->
              <div class="bg-white p-6 rounded-lg shadow-lg">
                <h2 class="text-2xl font-semibold mb-5">Adicionar Novo Pedido</h2>
                <form [formGroup]="pedidoForm" (ngSubmit)="handleFormSubmit()" class="space-y-4">
                    
                    <!-- Seção de Identificação -->
                    <div>
                        <h3 class="text-lg font-medium text-gray-700 mb-2 border-b pb-1 flex items-center space-x-2">
                            <ion-icon name="person-outline" class="text-indigo-600"></ion-icon>
                            <span>Solicitante</span>
                        </h3>
                        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                                <label for="solicitante" class="block text-sm font-medium text-gray-600">Nome *</label>
                                <input type="text" id="solicitante" formControlName="solicitante" 
                                       class="mt-1 block w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                                       [class.border-gray-300]="!isInvalid('solicitante', pedidoForm)"
                                       [class.border-red-500]="isInvalid('solicitante', pedidoForm)" required>
                            </div>
                            <div>
                                <label for="matricula" class="block text-sm font-medium text-gray-600">Matrícula *</label>
                                <input type="text" id="matricula" formControlName="matricula" 
                                       class="mt-1 block w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                                       [class.border-gray-300]="!isInvalid('matricula', pedidoForm)"
                                       [class.border-red-500]="isInvalid('matricula', pedidoForm)" required>
                            </div>
                            <div>
                                <label for="area" class="block text-sm font-medium text-gray-600">Área *</label>
                                <select id="area" formControlName="area" 
                                        class="mt-1 block w-full px-3 py-2 border bg-white rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500" 
                                        [class.border-gray-300]="!isInvalid('area', pedidoForm)"
                                        [class.border-red-500]="isInvalid('area', pedidoForm)" required>
                                    <option value="">Selecione...</option>
                                    <option value="Envase">Envase</option>
                                    <option value="Processos">Processos</option>
                                    <option value="Utilidades">Utilidades</option>
                                    <option value="SHE">SHE</option>
                                    <option value="ADM">ADM</option>
                                    <option value="People">People</option>
                                </select>
                            </div>
                             <div>
                                <label for="email" class="block text-sm font-medium text-gray-600">E-mail *</label>
                                <input type="email" id="email" formControlName="email" 
                                       class="mt-1 block w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500" 
                                       [class.border-gray-300]="!isInvalid('email', pedidoForm)"
                                       [class.border-red-500]="isInvalid('email', pedidoForm)" required>
                                @if (isInvalid('email', pedidoForm)) {
                                  <p class="mt-1 text-xs text-red-600">E-mail inválido.</p>
                                }
                            </div>
                        </div>
                    </div>

                    <!-- Seção da Peça -->
                    <div>
                        <h3 class="text-lg font-medium text-gray-700 mb-2 border-b pb-1 flex items-center space-x-2">
                            <ion-icon name="hardware-chip-outline" class="text-indigo-600"></ion-icon>
                            <span>Detalhes da Peça</span>
                        </h3>
                        <div class="space-y-4">
                            <div>
                                <label for="peca-interesse" class="block text-sm font-medium text-gray-600">Peça de Interesse *</label>
                                <select id="peca-interesse" formControlName="pecaInteresse" 
                                        class="mt-1 block w-full px-3 py-2 border bg-white rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500" 
                                        [class.border-gray-300]="!isInvalid('pecaInteresse', pedidoForm)"
                                        [class.border-red-500]="isInvalid('pecaInteresse', pedidoForm)" required>
                                    <option value="">Selecione...</option>
                                    <option value="Faca para Etiquetadora">Faca para Etiquetadora</option>
                                    <option value="Sapata">Sapata</option>
                                    <option value="Tampão">Tampão</option>
                                    <option value="Chave para área de Processos">Chave para área de Processos</option>
                                    <option value="Hélice">Hélice</option>
                                    <option value="Tampa do Lava Olhos">Tampa do Lava Olhos</option>
                                    <option value="Tampa do Lava Olhos - Linha de Chopp">Tampa do Lava Olhos - Linha de Chopp</option>
                                    <option value="Pino identificador da abertura da válvula on-off">Pino identificador da abertura da válvula on-off</option>
                                    <option value="Outra">Outra</option>
                                </select>
                            </div>
                            <div [class.hidden]="pedidoForm.get('pecaInteresse')?.value !== 'Outra'">
                                <label for="peca-outra-descricao" class="block text-sm font-medium text-gray-600">Descreva a peça "Outra" *</label>
                                <input type="text" id="peca-outra-descricao" formControlName="pecaOutraDescricao" 
                                       class="mt-1 block w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                                       [class.border-gray-300]="!isInvalid('pecaOutraDescricao', pedidoForm)"
                                       [class.border-red-500]="isInvalid('pecaOutraDescricao', pedidoForm)">
                            </div>
                            <div>
                                <label for="codigo-fabricante" class="block text-sm font-medium text-gray-600">Código do Fabricante (Original) *</label>
                                <input type="text" id="codigo-fabricante" formControlName="codigoFabricante" 
                                       class="mt-1 block w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                                       [class.border-gray-300]="!isInvalid('codigoFabricante', pedidoForm)"
                                       [class.border-red-500]="isInvalid('codigoFabricante', pedidoForm)" required>
                            </div>
                            <div>
                                <label for="equipamento" class="block text-sm font-medium text-gray-600">Equipamento onde será usada *</label>
                                <input type="text" id="equipamento" formControlName="equipamento" 
                                       class="mt-1 block w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                                       [class.border-gray-300]="!isInvalid('equipamento', pedidoForm)"
                                       [class.border-red-500]="isInvalid('equipamento', pedidoForm)" required>
                            </div>
                        </div>
                    </div>

                    <!-- Seção da Impressão -->
                    <div>
                        <h3 class="text-lg font-medium text-gray-700 mb-2 border-b pb-1 flex items-center space-x-2">
                            <ion-icon name="settings-outline" class="text-indigo-600"></ion-icon>
                            <span>Detalhes da Impressão</span>
                        </h3>
                        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                                <label for="nome-arquivo" class="block text-sm font-medium text-gray-600">Nome do Arquivo (.stl, .3mf) *</label>
                                <input type="text" id="nome-arquivo" formControlName="nomeArquivo" 
                                       class="mt-1 block w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                                       [class.border-gray-300]="!isInvalid('nomeArquivo', pedidoForm)"
                                       [class.border-red-500]="isInvalid('nomeArquivo', pedidoForm)" required>
                            </div>
                            <div>
                                <label for="prioridade" class="block text-sm font-medium text-gray-600">Prioridade *</label>
                                <select id="prioridade" formControlName="prioridade" 
                                        class="mt-1 block w-full px-3 py-2 border bg-white rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500" 
                                        [class.border-gray-300]="!isInvalid('prioridade', pedidoForm)"
                                        [class.border-red-500]="isInvalid('prioridade', pedidoForm)" required>
                                    <option value="Baixa">Baixa</option>
                                    <option value="Média">Média</option>
                                    <option value="Alta">Alta</option>
                                </select>
                            </div>
                            <div>
                                <label for="material" class="block text-sm font-medium text-gray-600">Material *</label>
                                <select id="material" formControlName="material" 
                                        class="mt-1 block w-full px-3 py-2 border bg-white rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500" 
                                        [class.border-gray-300]="!isInvalid('material', pedidoForm)"
                                        [class.border-red-500]="isInvalid('material', pedidoForm)" required>
                                    <option value="">Selecione...</option>
                                    <option value="PLA">PLA</option>
                                    <option value="ABS">ABS</option>
                                    <option value="PETG">PETG</option>
                                    <option value="TPU">TPU</option>
                                    <option value="Outro">Outro</option>
                                </select>
                            </div>
                            <div>
                                <label for="cor" class="block text-sm font-medium text-gray-600">Cor *</label>
                                <input type="text" id="cor" formControlName="cor" 
                                       class="mt-1 block w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                                       [class.border-gray-300]="!isInvalid('cor', pedidoForm)"
                                       [class.border-red-500]="isInvalid('cor', pedidoForm)" required>
                            </div>
                        </div>
                    </div>

                    <!-- Botão de Submit -->
                    <div>
                        <button type="submit" [disabled]="pedidoForm.invalid || isSubmitting()" class="w-full flex items-center justify-center py-3 px-4 border border-transparent rounded-lg shadow-sm text-base font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition duration-150 ease-in-out disabled:opacity-50 disabled:cursor-not-allowed">
                          @if (isSubmitting()) {
                            <svg class="animate-spin h-5 w-5 mr-3 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            <span>Enviando...</span>
                          } @else {
                            <ion-icon name="add-circle-outline" class="mr-2 text-lg"></ion-icon>
                            <span>Adicionar Pedido à Fila</span>
                          }
                        </button>
                        @if (submitMessage()) {
                          <p class="text-sm text-center mt-3" [class.text-green-600]="submitSuccess()" [class.text-red-600]="!submitSuccess()">
                            {{ submitMessage() }}
                          </p>
                        }
                    </div>
                </form>
              </div>

              <!-- Coluna 2: Histórico do Usuário -->
              <div class="bg-white p-6 rounded-lg shadow-lg">
                <h2 class="text-2xl font-semibold mb-5">Meus Pedidos</h2>
                <div class="space-y-3 max-h-[800px] overflow-y-auto">
                  @if (myPedidos().length > 0) {
                    @for (pedido of computedMyPedidos(); track pedido.id) {
                      <div class="border border-gray-200 rounded-lg p-4">
                        <div class="flex justify-between items-center mb-2">
                          <h3 class="text-lg font-semibold text-gray-800">
                            {{ pedido.pecaInteresse === 'Outra' ? pedido.pecaOutraDescricao : pedido.pecaInteresse }}
                          </h3>
                          <span class="text-sm font-medium px-3 py-1 rounded-full {{ getStatusClass(pedido.status) }}">
                            {{ pedido.status }}
                          </span>
                        </div>
                        <p class="text-sm text-gray-500">
                          Solicitado em: {{ pedido.createdAt ? (pedido.createdAt.seconds * 1000 | date:'dd/MM/yy HH:mm') : '...' }}
                        </p>
                        <p class="text-sm text-gray-500">
                          Prioridade: <span class="font-medium {{ getPriorityClass(pedido.prioridade) }} px-2 py-0.5 rounded-full">{{ pedido.prioridade }}</span>
                        </p>
                      </div>
                    }
                  } @else {
                    <div class="text-center text-gray-500 py-10">
                      <ion-icon name="file-tray-outline" class="text-6xl text-gray-300"></ion-icon>
                      <p class="mt-2 text-lg">Você ainda não fez pedidos.</p>
                      <p class="text-sm">Pedidos enviados por você aparecerão aqui.</p>
                    </div>
                  }
                </div>
              </div>

            </div>
          }

          <!-- PÁGINA DO ADMIN (Fila) -->
          @case ('admin') {
            <div class="bg-white p-6 rounded-lg shadow-lg">
              <h2 class="text-2xl font-semibold mb-5">Fila de Impressão (Admin)</h2>
              
              <!-- Controles de Ordenação -->
              <div class="flex flex-wrap items-center space-x-2 mb-4">
                  <span class="text-sm font-medium text-gray-600">Ordenar por:</span>
                  <button (click)="setSortBy('createdAt')" class="sort-btn px-3 py-1 rounded-full text-sm font-medium transition-colors duration-150"
                    [class.bg-indigo-100]="currentSortBy() === 'createdAt'" [class.text-indigo-800]="currentSortBy() === 'createdAt'"
                    [class.bg-gray-100]="currentSortBy() !== 'createdAt'" [class.text-gray-700]="currentSortBy() !== 'createdAt'" [class.hover:bg-gray-200]="currentSortBy() !== 'createdAt'">
                    Data (Padrão)
                  </button>
                  <button (click)="setSortBy('prioridade')" class="sort-btn px-3 py-1 rounded-full text-sm font-medium transition-colors duration-150"
                    [class.bg-indigo-100]="currentSortBy() === 'prioridade'" [class.text-indigo-800]="currentSortBy() === 'prioridade'"
                    [class.bg-gray-100]="currentSortBy() !== 'prioridade'" [class.text-gray-700]="currentSortBy() !== 'prioridade'" [class.hover:bg-gray-200]="currentSortBy() !== 'prioridade'">
                    Prioridade
                  </button>
                  <button (click)="setSortBy('status')" class="sort-btn px-3 py-1 rounded-full text-sm font-medium transition-colors duration-150"
                    [class.bg-indigo-100]="currentSortBy() === 'status'" [class.text-indigo-800]="currentSortBy() === 'status'"
                    [class.bg-gray-100]="currentSortBy() !== 'status'" [class.text-gray-700]="currentSortBy() !== 'status'" [class.hover:bg-gray-200]="currentSortBy() !== 'status'">
                    Status
                  </button>
              </div>

              <!-- Div da Fila -->
              <div class="space-y-4">
                @if (pedidos().length > 0) {
                  @for (pedido of computedAdminPedidos(); track pedido.id) {
                    <div class="bg-white border border-gray-200 rounded-lg shadow-md p-4 transition-all duration-300 hover:shadow-lg">
                      <div class="flex flex-col sm:flex-row justify-between sm:items-center mb-3">
                        <h3 class="text-xl font-semibold text-gray-800 mb-2 sm:mb-0">
                          {{ pedido.pecaInteresse === 'Outra' ? pedido.pecaOutraDescricao : pedido.pecaInteresse }}
                        </h3>
                        <span class="text-sm font-medium px-3 py-1 rounded-full {{ getPriorityClass(pedido.prioridade) }}">
                            Prioridade: {{ pedido.prioridade }}
                        </span>
                      </div>
                      <div class="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm text-gray-600 mb-4">
                          <div>
                              <strong>Solicitante:</strong>
                              <p>{{ pedido.solicitante }} ({{ pedido.matricula }})</p>
                          </div>
                          <div>
                              <strong>Área:</strong>
                              <p>{{ pedido.area }}</p>
                          </div>
                          <div>
                              <strong>Equipamento:</strong>
                              <p>{{ pedido.equipamento }}</p>
                          </div>
                          <div>
                              <strong>Arquivo:</strong>
                              <p class="font-mono">{{ pedido.nomeArquivo }}</p>
                          </div>
                          <div>
                              <strong>Material:</strong>
                              <p>{{ pedido.material }} ({{ pedido.cor }})</p>
                          </div>
                          <div>
                              <strong>Pedido em:</strong>
                              <p>{{ pedido.createdAt ? (pedido.createdAt.seconds * 1000 | date:'dd/MM/yy HH:mm') : '...' }}</p>
                          </div>
                      </div>
                      <!-- Gerenciamento de Status -->
                      <div class="flex items-center justify-between bg-gray-50 p-3 rounded-lg">
                          <label [for]="'status-' + pedido.id" class="text-sm font-medium text-gray-700">Atualizar Status:</label>
                          <select [id]="'status-' + pedido.id" 
                                  (change)="updateStatus(pedido.id, $event)"
                                  class="status-select w-1/2 p-2 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 transition-all duration-200 {{ getStatusClass(pedido.status) }}">
                              <option value="Pendente" [selected]="pedido.status === 'Pendente'">Pendente</option>
                              <option value="Em Andamento" [selected]="pedido.status === 'Em Andamento'">Em Andamento</option>
                              <option value="Concluído" [selected]="pedido.status === 'Concluído'">Concluído</option>
                              <option value="Falha" [selected]="pedido.status === 'Falha'">Falha / Cancelado</option>
                          </select>
                      </div>
                    </div>
                  }
                } @else {
                  <!-- Estado de Fila Vazia -->
                  <div class="text-center text-gray-500 py-10">
                    <ion-icon name="file-tray-outline" class="text-6xl text-gray-300"></ion-icon>
                    <p class="mt-2 text-lg">Nenhum pedido na fila.</p>
                    <p class="text-sm">Novos pedidos aparecerão aqui.</p>
                  </div>
                }
              </div>
            </div>
          }
        }
      }
    </div>
  `,
  styles: [
    `
    /* Estilo para a fonte Inter */
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
    :host {
        font-family: 'Inter', sans-serif;
    }
    /* Estilo para a barra de rolagem */
    ::-webkit-scrollbar {
        width: 8px;
    }
    ::-webkit-scrollbar-track {
        background: #f1f1f1;
    }
    ::-webkit-scrollbar-thumb {
        background: #888;
        border-radius: 4px;
    }
    ::-webkit-scrollbar-thumb:hover {
        background: #555;
    }
    `
  ]
})
export class App implements OnInit, OnDestroy {
  // --- Injeção de Dependências ---
  private fb = inject(FormBuilder);

  // --- Estado da Aplicação (Signals) ---
  authReady = signal<boolean>(false);
  currentPage = signal<'login' | 'user' | 'admin'>('login');
  userRole = signal<'user' | 'admin' | null>(null);
  userId = signal<string | null>(null);
  loginError = signal<string | null>(null);
  isLoggingIn = signal<boolean>(false);
  
  pedidos = signal<any[]>([]); // Fila de pedidos (Admin)
  myPedidos = signal<any[]>([]); // Fila de pedidos (Usuário)
  currentSortBy = signal<'createdAt' | 'prioridade' | 'status'>('createdAt');
  
  isSubmitting = signal<boolean>(false);
  submitMessage = signal<string | null>(null);
  submitSuccess = signal<boolean>(false);

  // --- Firebase (Inicialização manual) ---
  app: FirebaseApp;
  auth: Auth;
  db: Firestore;
  private collectionPath: string;
  private unsubscribeFromPedidos: (() => void) | null = null;
  private unsubscribeFromMyPedidos: (() => void) | null = null;
  private destroy$ = new Subject<void>();

  // --- Formulários Reativos ---
  loginForm: FormGroup;
  pedidoForm: FormGroup;

  constructor() {
    // Habilita logs para debug
    setLogLevel('Debug');
    
    // Inicializa Firebase
    this.app = initializeApp(firebaseConfig);
    this.auth = getAuth(this.app);
    this.db = getFirestore(this.app);
    this.collectionPath = `/artifacts/${appId}/public/data/${COLLECTION_NAME}`;

    // Inicializa Formulário de Login
    this.loginForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(6)]]
    });

    // Inicializa Formulário de Pedido
    this.pedidoForm = this.fb.group({
      solicitante: ['', Validators.required],
      matricula: ['', Validators.required],
      area: ['', Validators.required],
      email: ['', [Validators.required, Validators.email]],
      pecaInteresse: ['', Validators.required],
      pecaOutraDescricao: [''],
      codigoFabricante: ['', Validators.required],
      equipamento: ['', Validators.required],
      nomeArquivo: ['', Validators.required],
      prioridade: ['Média', Validators.required],
      material: ['', Validators.required],
      cor: ['', Validators.required]
    });

    // Listener para autenticação
    onAuthStateChanged(this.auth, (user) => {
      if (user) {
        console.log("Usuário autenticado:", user.uid, user.email);
        this.userId.set(user.uid);
        
        // --- Lógica de Cargo (Simulada) ---
        if (user.email === 'admin@app.com') {
          this.userRole.set('admin');
          this.currentPage.set('admin');
          this.listenToPedidos(); // Admin ouve a fila total
          if (this.unsubscribeFromMyPedidos) this.unsubscribeFromMyPedidos(); // Para de ouvir os "meus"
          this.myPedidos.set([]);
        } else {
          // <-- ESTE BLOCO 'ELSE' ESTAVA FALTANDO
          this.userRole.set('user');
          this.currentPage.set('user');
          this.listenToMyPedidos(); // Usuário ouve os próprios pedidos
          if (this.unsubscribeFromPedidos) this.unsubscribeFromPedidos(); // Para de ouvir o "total"
          this.pedidos.set([]);
        }

      } else {
        console.log("Usuário não autenticado.");
        this.userId.set(null);
        this.userRole.set(null);
        this.currentPage.set('login');
        // Limpa todas as subscrições e dados ao sair
        if (this.unsubscribeFromPedidos) this.unsubscribeFromPedidos(); 
        if (this.unsubscribeFromMyPedidos) this.unsubscribeFromMyPedidos();
        this.pedidos.set([]);
        this.myPedidos.set([]);
      }
      this.authReady.set(true);
      this.isLoggingIn.set(false);
    });

    /* REMOVIDO: Este bloco estava causando o erro "auth/admin-restricted-operation"
       Ele não é mais necessário pois estamos usando login com Email/Senha.
       O listener onAuthStateChanged acima já cuida de direcionar para a tela de login.
    */
    // Tenta login anônimo ou com token (necessário para o ambiente)
    /*
    this.auth.currentUser || (async () => {
        try {
            if (initialAuthToken) {
                await signInWithCustomToken(this.auth, initialAuthToken);
            } else {
                await signInAnonymously(this.auth);
                // Após login anônimo, forçamos o logout para ir para a tela de login
                await signOut(this.auth); 
            }
        } catch (error) {
            console.error("Erro na autenticação inicial:", error);
            this.authReady.set(true); // Permite ir para o login mesmo se falhar
        }
    })();
    */
  }

  ngOnInit() {
    // Lógica reativa para o campo "Outra Peça"
    this.pedidoForm.get('pecaInteresse')?.valueChanges
      .pipe(takeUntil(this.destroy$))
      .subscribe(value => {
        const outraDescricaoControl = this.pedidoForm.get('pecaOutraDescricao');
        if (value === 'Outra') {
          outraDescricaoControl?.setValidators([Validators.required]);
        } else {
          outraDescricaoControl?.clearValidators();
        }
        outraDescricaoControl?.updateValueAndValidity();
      });
  }

  ngOnDestroy() {
    if (this.unsubscribeFromPedidos) this.unsubscribeFromPedidos();
    if (this.unsubscribeFromMyPedidos) this.unsubscribeFromMyPedidos();
    this.destroy$.next();
    this.destroy$.complete();
  }

  // --- Lógica de Autenticação ---
  async handleLogin() {
    if (this.loginForm.invalid) return;

    this.isLoggingIn.set(true);
    this.loginError.set(null);
    
    const { email, password } = this.loginForm.value;

    try {
      await signInWithEmailAndPassword(this.auth, email, password);
    } catch (error: any) {
      if (error.code === 'auth/user-not-found') {
        if (email === 'admin@app.com') {
             this.loginError.set("Credenciais de admin inválidas.");
        } else {
            try {
                await createUserWithEmailAndPassword(this.auth, email, password);
            } catch (createError: any) {
                 this.loginError.set(this.formatFirebaseError(createError.code));
            }
        }
      } else {
         this.loginError.set(this.formatFirebaseError(error.code));
      }
      this.isLoggingIn.set(false);
    }
  }

  async handleLogout() {
    await signOut(this.auth);
  }

  formatFirebaseError(code: string): string {
    switch (code) {
      case 'auth/wrong-password': return 'Senha incorreta.';
      case 'auth/invalid-email': return 'Formato de e-mail inválido.';
      case 'auth/weak-password': return 'A senha deve ter pelo menos 6 caracteres.';
      case 'auth/email-already-in-use': return 'Este e-mail já está em uso.';
      default: return 'Erro ao tentar fazer login.';
    }
  }

  // Helper para validação visual
  isInvalid(controlName: string, form: FormGroup): boolean {
    const control = form.get(controlName);
    return !!control && control.invalid && (control.dirty || control.touched);
  }

  // --- Lógica do Formulário (Usuário) ---
  async handleFormSubmit() {
    if (this.pedidoForm.invalid) {
      // Marca todos os campos como "tocados" para exibir a validação
      this.pedidoForm.markAllAsTouched();
      return;
    }

    this.isSubmitting.set(true);
    this.submitMessage.set(null);

    try {
      const formValue = this.pedidoForm.value;
      const novoPedido = {
        ...formValue,
        status: 'Pendente',
        createdAt: serverTimestamp(),
        solicitanteId: this.userId() // Salva quem pediu
      };

      await addDoc(collection(this.db, this.collectionPath), novoPedido);
      
      this.pedidoForm.reset({
          prioridade: 'Média',
          // Reseta outros campos se necessário, mantendo valores padrão
          solicitante: '',
          matricula: '',
          area: '',
          email: '',
          pecaInteresse: '',
          pecaOutraDescricao: '',
          codigoFabricante: '',
          equipamento: '',
          nomeArquivo: '',
          material: '',
          cor: ''
      });
      // Reseta o estado do formulário para "pristine"
      this.pedidoForm.markAsPristine();
      this.pedidoForm.markAsUntouched();

      this.submitSuccess.set(true);
      this.submitMessage.set('Pedido enviado com sucesso!');

    } catch (error) {
      console.error("Erro ao adicionar pedido: ", error);
      this.submitSuccess.set(false);
      this.submitMessage.set('Erro ao enviar pedido. Tente novamente.');
    } finally {
      this.isSubmitting.set(false);
      // Limpa a mensagem após 3 segundos
      setTimeout(() => this.submitMessage.set(null), 3000);
    }
  }

  // --- Lógica da Fila (Admin) ---

  listenToPedidos() {
    if (this.unsubscribeFromPedidos) this.unsubscribeFromPedidos();
    
    if (this.userRole() === 'admin') {
      const q = query(collection(this.db, this.collectionPath));
      
      this.unsubscribeFromPedidos = onSnapshot(q, (querySnapshot) => {
          console.log("Recebidos dados da fila (Admin)...");
          const pedidosData: any[] = [];
          querySnapshot.forEach((doc) => {
              pedidosData.push({ id: doc.id, ...doc.data() });
          });
          this.pedidos.set(pedidosData);
      }, (error) => {
          console.error("Erro ao ouvir a coleção: ", error);
      });
    }
  }

  // Pedidos computados e ordenados (ADMIN)
  computedAdminPedidos = computed(() => {
    return this.sortPedidos(this.pedidos());
  });

  // --- Lógica da Fila (Usuário) ---

  listenToMyPedidos() {
    if (this.unsubscribeFromMyPedidos) this.unsubscribeFromMyPedidos();
    
    const uid = this.userId();
    if (this.userRole() === 'user' && uid) {
      // Query que filtra pelo ID do solicitante
      const q = query(
        collection(this.db, this.collectionPath), 
        where("solicitanteId", "==", uid)
      );
      
      this.unsubscribeFromMyPedidos = onSnapshot(q, (querySnapshot) => {
          console.log("Recebidos dados da fila (Usuário)...");
          const pedidosData: any[] = [];
          querySnapshot.forEach((doc) => {
              pedidosData.push({ id: doc.id, ...doc.data() });
          });
          this.myPedidos.set(pedidosData);
      }, (error) => {
          console.error("Erro ao ouvir os pedidos do usuário: ", error);
      });
    }
  }

  // Pedidos computados e ordenados (USUÁRIO)
  computedMyPedidos = computed(() => {
    return this.sortPedidos(this.myPedidos());
  });

  // --- Funções Comuns de Ordenação e UI ---

  // Função de ordenação genérica
  sortPedidos(pedidos: any[]): any[] {
    const sortBy = this.currentSortBy();
    const priorityMap: { [key: string]: number } = { 'Alta': 1, 'Média': 2, 'Baixa': 3 };
    const statusMap: { [key: string]: number } = { 'Pendente': 1, 'Em Andamento': 2, 'Concluído': 3, 'Falha': 4 };

    return [...pedidos].sort((a, b) => {
        switch (sortBy) {
            case 'prioridade':
                return (priorityMap[a.prioridade] || 9) - (priorityMap[b.prioridade] || 9);
            case 'status':
                return (statusMap[a.status] || 9) - (statusMap[b.status] || 9);
            case 'createdAt':
            default:
                return (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0);
        }
    });
  }

  setSortBy(field: 'createdAt' | 'prioridade' | 'status') {
    this.currentSortBy.set(field);
  }

  async updateStatus(pedidoId: string, event: any) {
    const newStatus = event.target.value;
    try {
        const docRef = doc(this.db, this.collectionPath, pedidoId);
        await updateDoc(docRef, {
            status: newStatus
        });
    } catch (error) {
        console.error("Erro ao atualizar status: ", error);
    }
  }

  // --- Funções Auxiliares de UI ---
  getPriorityClass(priority: string): string {
      switch (priority) {
          case 'Alta': return 'bg-red-100 text-red-800';
          case 'Média': return 'bg-yellow-100 text-yellow-800';
          case 'Baixa': return 'bg-green-100 text-green-800';
          default: return 'bg-gray-100 text-gray-800';
      }
  }

  getStatusClass(status: string): string {
      switch (status) {
          case 'Pendente': return 'bg-gray-200 text-gray-700';
          case 'Em Andamento': return 'bg-blue-200 text-blue-700';
          case 'Concluído': return 'bg-green-200 text-green-700';
          case 'Falha': return 'bg-red-200 text-red-700';
          default: return 'bg-gray-100 text-gray-800';
      }
  }
}